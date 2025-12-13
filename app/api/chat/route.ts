import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { queryIndex, formatContextForPrompt, formatSources } from "@/lib/pinecone";
import { buildSystemPrompt } from "@/lib/prompts";
import { executeCalculation } from "@/lib/calculator";
import { Message, UserContext, ChatResponse } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Tool definitions for Claude
const tools: Anthropic.Tool[] = [
  {
    name: "calculate",
    description:
      "Execute financial calculations like unit economics, TAM/SAM/SOM, break-even analysis, and runway calculations. Use this whenever the student needs help with numbers.",
    input_schema: {
      type: "object" as const,
      properties: {
        calculation_type: {
          type: "string",
          enum: ["unit_economics", "tam_sam_som", "break_even", "runway"],
          description: "The type of calculation to perform",
        },
        inputs: {
          type: "object",
          description: "Key-value pairs of numeric inputs for the calculation",
          additionalProperties: { type: "number" },
        },
      },
      required: ["calculation_type", "inputs"],
    },
  },
];

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      userContext,
    }: { messages: Message[]; userContext: UserContext | null } =
      await request.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 }
      );
    }

    // Get the latest user message for RAG query
    const latestMessage = messages[messages.length - 1];
    if (latestMessage.role !== "user") {
      return NextResponse.json(
        { error: "Last message must be from user" },
        { status: 400 }
      );
    }

    // Query the knowledge base
    let retrievedContext = "No content retrieved from knowledge base.";
    let sources: ChatResponse["sources"] = [];

    try {
      const queryResults = await queryIndex(latestMessage.content, { topK: 5 });
      if (queryResults.length > 0) {
        retrievedContext = formatContextForPrompt(queryResults);
        sources = formatSources(queryResults);
      }
    } catch (error) {
      console.error("Error querying knowledge base:", error);
      // Continue without RAG context if query fails
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(userContext, retrievedContext);

    // Format messages for Claude API
    const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Call Claude
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: claudeMessages,
      tools,
    });

    // Handle tool calls
    while (response.stop_reason === "tool_use") {
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (!toolUseBlock) break;

      let toolResult: string;

      if (toolUseBlock.name === "calculate") {
        const input = toolUseBlock.input as {
          calculation_type: string;
          inputs: Record<string, number>;
        };

        const result = executeCalculation(input.calculation_type, input.inputs);
        toolResult = JSON.stringify(result, null, 2);
      } else {
        toolResult = JSON.stringify({ error: "Unknown tool" });
      }

      // Continue conversation with tool result
      claudeMessages.push({
        role: "assistant",
        content: response.content,
      });

      claudeMessages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUseBlock.id,
            content: toolResult,
          },
        ],
      });

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: claudeMessages,
        tools,
      });
    }

    // Extract text response
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    const responseText = textBlock?.text || "I'm sorry, I couldn't generate a response.";

    return NextResponse.json({
      message: responseText,
      sources,
    } as ChatResponse);
  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { executeCalculation } from "@/lib/calculator";

export async function POST(request: NextRequest) {
  try {
    const { calculationType, inputs } = await request.json();

    if (!calculationType) {
      return NextResponse.json(
        { error: "calculationType is required" },
        { status: 400 }
      );
    }

    if (!inputs || typeof inputs !== "object") {
      return NextResponse.json(
        { error: "inputs must be an object with numeric values" },
        { status: 400 }
      );
    }

    // Validate that all inputs are numbers
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value !== "number") {
        return NextResponse.json(
          { error: `Input "${key}" must be a number` },
          { status: 400 }
        );
      }
    }

    const validTypes = ["unit_economics", "tam_sam_som", "break_even", "runway"];
    if (!validTypes.includes(calculationType)) {
      return NextResponse.json(
        {
          error: `Invalid calculationType. Must be one of: ${validTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const result = executeCalculation(calculationType, inputs);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Calculate API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Also support GET for simple calculations via query params
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const calculationType = searchParams.get("type");

  if (!calculationType) {
    return NextResponse.json(
      {
        error: "type query parameter is required",
        validTypes: ["unit_economics", "tam_sam_som", "break_even", "runway"],
        usage: {
          unit_economics:
            "?type=unit_economics&monthlyRevenuePerCustomer=100&averageCustomerLifespanMonths=24&customerAcquisitionCost=200",
          tam_sam_som:
            "?type=tam_sam_som&totalAddressableMarket=1000000000&serviceableAddressableMarketPercent=10&realisticMarketSharePercent=5",
          break_even:
            "?type=break_even&monthlyFixedCosts=10000&pricePerUnit=100&variableCostPerUnit=30",
          runway:
            "?type=runway&currentCash=500000&monthlyBurnRate=50000&monthlyRevenue=10000",
        },
      },
      { status: 400 }
    );
  }

  // Extract numeric parameters
  const inputs: Record<string, number> = {};
  searchParams.forEach((value, key) => {
    if (key !== "type") {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        inputs[key] = numValue;
      }
    }
  });

  const validTypes = ["unit_economics", "tam_sam_som", "break_even", "runway"];
  if (!validTypes.includes(calculationType)) {
    return NextResponse.json(
      {
        error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const result = executeCalculation(calculationType, inputs);

  return NextResponse.json(result);
}

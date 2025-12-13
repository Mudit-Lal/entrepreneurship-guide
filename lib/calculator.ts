import { CalculationResult } from "@/types";

/**
 * Calculate unit economics metrics.
 *
 * Expected inputs:
 * - monthlyRevenuePerCustomer: number
 * - averageCustomerLifespanMonths: number
 * - customerAcquisitionCost: number
 * - monthlyVariableCostPerCustomer: number (optional)
 */
export function calculateUnitEconomics(inputs: {
  monthlyRevenuePerCustomer: number;
  averageCustomerLifespanMonths: number;
  customerAcquisitionCost: number;
  monthlyVariableCostPerCustomer?: number;
}): CalculationResult {
  const {
    monthlyRevenuePerCustomer,
    averageCustomerLifespanMonths,
    customerAcquisitionCost,
    monthlyVariableCostPerCustomer = 0,
  } = inputs;

  const grossRevenueLtv = monthlyRevenuePerCustomer * averageCustomerLifespanMonths;
  const totalVariableCost = monthlyVariableCostPerCustomer * averageCustomerLifespanMonths;
  const ltv = grossRevenueLtv - totalVariableCost;

  const ltvCacRatio = customerAcquisitionCost > 0 ? ltv / customerAcquisitionCost : Infinity;

  const monthlyProfit = monthlyRevenuePerCustomer - monthlyVariableCostPerCustomer;
  const paybackMonths = monthlyProfit > 0 ? customerAcquisitionCost / monthlyProfit : Infinity;

  let assessment: string;
  if (ltvCacRatio < 1) {
    assessment =
      "Critical: You're losing money on every customer. This model doesn't work without significant changes to either increase customer value or reduce acquisition costs.";
  } else if (ltvCacRatio < 3) {
    assessment =
      "Concerning: Your LTV:CAC ratio is below the healthy threshold of 3:1. Look for ways to increase customer lifetime value (higher prices, lower churn, upsells) or reduce customer acquisition costs.";
  } else if (paybackMonths > 18) {
    assessment =
      "Warning: Long payback period means you'll need significant capital to grow. Your unit economics are positive, but you'll need to fund 18+ months of CAC before seeing returns. Consider ways to accelerate revenue or reduce CAC.";
  } else if (ltvCacRatio >= 3 && paybackMonths <= 12) {
    assessment =
      "Healthy: Your unit economics look solid with a strong LTV:CAC ratio and reasonable payback period. Focus on validating these assumptions with real customer data as you scale.";
  } else {
    assessment =
      "Moderate: Your numbers are workable but not exceptional. Continue refining as you get more data. Look for opportunities to improve either customer value or acquisition efficiency.";
  }

  return {
    lifetimeValue: Math.round(ltv * 100) / 100,
    ltvCacRatio: Math.round(ltvCacRatio * 100) / 100,
    paybackPeriodMonths: Math.round(paybackMonths * 10) / 10,
    monthlyProfitPerCustomer: Math.round(monthlyProfit * 100) / 100,
    assessment,
  };
}

/**
 * Calculate TAM, SAM, SOM market sizes.
 *
 * Expected inputs:
 * - totalAddressableMarket: number (TAM in dollars)
 * - serviceableAddressableMarketPercent: number (what % of TAM you can serve)
 * - realisticMarketSharePercent: number (what % of SAM you can capture)
 */
export function calculateTamSamSom(inputs: {
  totalAddressableMarket: number;
  serviceableAddressableMarketPercent: number;
  realisticMarketSharePercent: number;
}): CalculationResult {
  const {
    totalAddressableMarket,
    serviceableAddressableMarketPercent,
    realisticMarketSharePercent,
  } = inputs;

  const sam = totalAddressableMarket * (serviceableAddressableMarketPercent / 100);
  const som = sam * (realisticMarketSharePercent / 100);

  let assessment: string;
  if (som < 1_000_000) {
    assessment =
      "Small market: Your serviceable obtainable market suggests this might be a lifestyle business rather than a venture-scale opportunity. That's okay if that's your goal, but VCs typically look for larger opportunities. Consider whether you can expand your target market or if bootstrapping is the right path.";
  } else if (som < 10_000_000) {
    assessment =
      "Moderate market: Your SOM could support a solid business generating $1-10M in revenue. This may be challenging to raise VC funding for, but could be attractive to angel investors or work well as a bootstrapped company.";
  } else if (som < 100_000_000) {
    assessment =
      "Good market size: Your SOM is large enough to be interesting to venture investors if other factors (team, traction, differentiation) align. Focus on demonstrating you can capture this opportunity.";
  } else {
    assessment =
      "Large market: Market size isn't your constraint—execution is. With a $100M+ SOM, focus on demonstrating differentiation, building a great team, and showing early traction.";
  }

  return {
    tam: totalAddressableMarket,
    sam: Math.round(sam),
    som: Math.round(som),
    assessment,
  };
}

/**
 * Calculate break-even point.
 *
 * Expected inputs:
 * - monthlyFixedCosts: number
 * - pricePerUnit: number
 * - variableCostPerUnit: number
 */
export function calculateBreakEven(inputs: {
  monthlyFixedCosts: number;
  pricePerUnit: number;
  variableCostPerUnit: number;
}): CalculationResult {
  const { monthlyFixedCosts, pricePerUnit, variableCostPerUnit } = inputs;

  const contributionMargin = pricePerUnit - variableCostPerUnit;

  if (contributionMargin <= 0) {
    return {
      contributionMarginPerUnit: contributionMargin,
      assessment:
        "Critical: Your price doesn't cover variable costs. You lose money on every sale regardless of volume. You must either raise prices or reduce variable costs before this business can be viable.",
    };
  }

  const breakEvenUnits = Math.ceil(monthlyFixedCosts / contributionMargin);
  const breakEvenRevenue = breakEvenUnits * pricePerUnit;

  let assessment: string;
  if (breakEvenUnits <= 10) {
    assessment = `Low break-even: You only need ${breakEvenUnits} sales per month to cover fixed costs. This is achievable and gives you room to experiment.`;
  } else if (breakEvenUnits <= 100) {
    assessment = `Moderate break-even: ${breakEvenUnits} sales per month is achievable but requires consistent sales effort. Focus on building repeatable acquisition channels.`;
  } else if (breakEvenUnits <= 1000) {
    assessment = `High break-even: ${breakEvenUnits} sales per month requires significant volume. Make sure you have a scalable acquisition strategy before committing to this cost structure.`;
  } else {
    assessment = `Very high break-even: ${breakEvenUnits} sales per month is a high bar. Consider whether your fixed costs can be reduced, or if your pricing/margin can be improved.`;
  }

  return {
    contributionMarginPerUnit: Math.round(contributionMargin * 100) / 100,
    breakEvenUnitsPerMonth: breakEvenUnits,
    breakEvenRevenuePerMonth: Math.round(breakEvenRevenue * 100) / 100,
    assessment,
  };
}

/**
 * Calculate runway based on current resources and burn rate.
 *
 * Expected inputs:
 * - currentCash: number
 * - monthlyBurnRate: number
 * - monthlyRevenue: number (optional)
 */
export function calculateRunway(inputs: {
  currentCash: number;
  monthlyBurnRate: number;
  monthlyRevenue?: number;
}): CalculationResult {
  const { currentCash, monthlyBurnRate, monthlyRevenue = 0 } = inputs;

  const netBurn = monthlyBurnRate - monthlyRevenue;

  if (netBurn <= 0) {
    return {
      netMonthlyBurn: netBurn,
      runwayMonths: Infinity,
      assessment:
        "You're profitable or break-even—congratulations! Runway isn't your constraint. Focus on growth and reinvestment.",
    };
  }

  const runwayMonths = currentCash / netBurn;

  let assessment: string;
  if (runwayMonths < 3) {
    assessment =
      "Critical: Less than 3 months of runway. You need to either generate revenue, drastically cut costs, or close funding immediately. Fundraising typically takes 3-6 months, so you're in a very difficult position.";
  } else if (runwayMonths < 6) {
    assessment =
      "Urgent: With 6 months or less of runway, you should start fundraising or a major revenue push now. These things take longer than you think. Don't wait until you're desperate.";
  } else if (runwayMonths < 12) {
    assessment =
      "Moderate: You have some time but should be actively working on extending runway. Start conversations with investors now, or focus on getting to profitability.";
  } else if (runwayMonths < 18) {
    assessment =
      "Comfortable: 12-18 months gives you room to experiment and iterate. Don't waste it—focus on finding product-market fit and building repeatable growth.";
  } else {
    assessment =
      "Strong: 18+ months of runway is excellent. You have time to be thoughtful and take calculated risks. Use this time wisely to build something great.";
  }

  return {
    netMonthlyBurn: Math.round(netBurn * 100) / 100,
    runwayMonths: Math.round(runwayMonths * 10) / 10,
    assessment,
  };
}

/**
 * Main entry point for calculator tool.
 */
export function executeCalculation(
  calculationType: string,
  inputs: Record<string, number>
): CalculationResult {
  switch (calculationType) {
    case "unit_economics":
      return calculateUnitEconomics({
        monthlyRevenuePerCustomer: inputs.monthlyRevenuePerCustomer || 0,
        averageCustomerLifespanMonths: inputs.averageCustomerLifespanMonths || 12,
        customerAcquisitionCost: inputs.customerAcquisitionCost || 0,
        monthlyVariableCostPerCustomer: inputs.monthlyVariableCostPerCustomer || 0,
      });

    case "tam_sam_som":
      return calculateTamSamSom({
        totalAddressableMarket: inputs.totalAddressableMarket || 0,
        serviceableAddressableMarketPercent: inputs.serviceableAddressableMarketPercent || 100,
        realisticMarketSharePercent: inputs.realisticMarketSharePercent || 1,
      });

    case "break_even":
      return calculateBreakEven({
        monthlyFixedCosts: inputs.monthlyFixedCosts || 0,
        pricePerUnit: inputs.pricePerUnit || 0,
        variableCostPerUnit: inputs.variableCostPerUnit || 0,
      });

    case "runway":
      return calculateRunway({
        currentCash: inputs.currentCash || 0,
        monthlyBurnRate: inputs.monthlyBurnRate || 0,
        monthlyRevenue: inputs.monthlyRevenue || 0,
      });

    default:
      return {
        error: `Unknown calculation type: ${calculationType}`,
        assessment: "Calculation type not recognized.",
      };
  }
}

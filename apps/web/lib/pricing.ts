import { Shop, PrintConfig, CostCalculation } from './types';

export function calculateClientCost(shop: Shop, config: PrintConfig): CostCalculation {
  const pageCount = config.pageCount || 1;
  const copyCount = config.copyCount || 1;
  const isColor = Boolean(config.isColor);
  const duplexMode = config.duplexMode || 'simplex';
  const layoutNup = config.layoutNup || 1;
  const paperType = config.paperType || 'normal';

  if (pageCount < 1 || pageCount > 1000 || copyCount < 1 || copyCount > 50) {
    throw new Error('Invalid page count or copies (pages: 1-1000, copies: 1-50)');
  }

  const supportedLayouts = shop.supported_layouts || [1, 2, 4, 8];
  if (!supportedLayouts.includes(layoutNup)) {
    throw new Error(`Invalid layout ${layoutNup}-up; shop supports ${supportedLayouts.join(', ')}`);
  }

  if (duplexMode !== 'simplex' && shop.supports_duplex === false) {
    throw new Error('Double-sided printing is not supported by this shop');
  }
  if (isColor && shop.supports_color === false) {
    throw new Error('Color printing is not supported by this shop');
  }
  if (!isColor && shop.supports_bw === false) {
    throw new Error('B&W printing is not supported by this shop');
  }

  // Group pages into sides based on N-up
  const sides = Math.ceil(pageCount / layoutNup);
  const sheets = duplexMode !== 'simplex' ? Math.ceil(sides / 2) : sides;

  const paperRates = shop.paper_rates;
  let paperConfig: any = null;
  if (paperRates && paperRates[paperType]) {
    paperConfig = paperRates[paperType];
  } else if (paperType === 'bond') {
    paperConfig = { bw_single: 3.0, bw_duplex: 5.0, color_single: 12.0, color_duplex: 22.0 };
  }

  let totalCost = 0;
  let discount = 0;
  let ratePerPage = isColor ? shop.base_color_rate : shop.base_bw_rate;

  if (paperConfig) {
    let simplexRate = 0;
    let duplexSheetRate = 0;

    if (isColor) {
      simplexRate = Number(paperConfig.color_single ?? paperConfig.color_simplex_rate ?? shop.base_color_rate ?? 10.0);
      duplexSheetRate = Number(paperConfig.color_duplex ?? paperConfig.color_duplex_rate ?? (simplexRate * 2));
    } else {
      simplexRate = Number(paperConfig.bw_single ?? paperConfig.bw_simplex_rate ?? shop.base_bw_rate ?? 2.0);
      const defaultDuplex = simplexRate * 2 - Number(shop.duplex_discount ?? 1.0);
      duplexSheetRate = Number(paperConfig.bw_duplex ?? paperConfig.bw_duplex_rate ?? defaultDuplex);
    }

    ratePerPage = simplexRate;

    if (duplexMode === 'simplex') {
      totalCost = sides * copyCount * simplexRate;
      discount = 0;
    } else {
      const duplexSheets = Math.floor(sides / 2);
      const oddSides = sides % 2;
      totalCost = copyCount * (duplexSheets * duplexSheetRate + oddSides * simplexRate);
      const undiscounted = sides * copyCount * simplexRate;
      discount = Math.max(0, undiscounted - totalCost);
    }
  } else {
    const rate = Number(isColor ? shop.base_color_rate : shop.base_bw_rate);
    ratePerPage = rate;
    const duplexSheets = Math.floor(sides / 2);
    discount = duplexMode !== 'simplex' ? Number(shop.duplex_discount || 0) * duplexSheets * copyCount : 0;
    totalCost = Math.max(0, sides * copyCount * rate - discount);
  }

  const roundedTotal = Math.round(totalCost * 100) / 100;
  const roundedDiscount = Math.round(discount * 100) / 100;

  return {
    page_count: pageCount,
    copy_count: copyCount,
    is_color: isColor,
    duplex_mode: duplexMode,
    layout_nup: layoutNup,
    paper_type: paperType,
    sheets_per_copy: sheets,
    total_sheets: sheets * copyCount,
    rate_per_page: Math.round(ratePerPage * 100) / 100,
    discount: roundedDiscount,
    total_cost: roundedTotal,
    currency: shop.currency || 'INR',
  };
}

export type AveryLabelFormat = "avery-L7160" | "avery-L7159" | "avery-5160" | "avery-5161";

export type AveryLabelLayout = "vertical" | "horizontal";

export type AveryLabelSpec = {
  pageSize: "A4" | "LETTER";
  cols: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  marginTopMm: number;
  marginLeftMm: number;
  gapHorizontalMm: number;
  gapVerticalMm: number;
  layout: AveryLabelLayout;
};

export const AVERY_LABEL_SPECS: Record<AveryLabelFormat, AveryLabelSpec> = {
  "avery-L7160": {
    pageSize: "A4",
    cols: 3,
    rows: 7,
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    marginTopMm: 15.1,
    marginLeftMm: 7,
    gapHorizontalMm: 2.5,
    gapVerticalMm: 0,
    layout: "vertical",
  },
  "avery-L7159": {
    pageSize: "A4",
    cols: 3,
    rows: 8,
    labelWidthMm: 63.5,
    labelHeightMm: 33.9,
    marginTopMm: 13.5,
    marginLeftMm: 7,
    gapHorizontalMm: 2.5,
    gapVerticalMm: 0,
    layout: "vertical",
  },
  "avery-5160": {
    pageSize: "LETTER",
    cols: 3,
    rows: 10,
    labelWidthMm: 66.7,
    labelHeightMm: 25.4,
    marginTopMm: 12.7,
    marginLeftMm: 4.76,
    gapHorizontalMm: 3.18,
    gapVerticalMm: 0,
    layout: "horizontal",
  },
  "avery-5161": {
    pageSize: "LETTER",
    cols: 2,
    rows: 10,
    labelWidthMm: 101.6,
    labelHeightMm: 25.4,
    marginTopMm: 12.7,
    marginLeftMm: 3.97,
    gapHorizontalMm: 5.56,
    gapVerticalMm: 0,
    layout: "horizontal",
  },
};

export function labelsPerPage(format: AveryLabelFormat): number {
  const s = AVERY_LABEL_SPECS[format];
  return s.cols * s.rows;
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages.length > 0 ? pages : [[]];
}

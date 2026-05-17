import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  AVERY_LABEL_SPECS,
  chunkItems,
  labelsPerPage,
  type AveryLabelFormat,
  type AveryLabelSpec,
} from "@/lib/inventoryQrLabelFormats";

export type QrLabelPdfItem = {
  id: string;
  name: string;
  model?: string;
  qrDataUrl: string;
};

export type QrLabelsPdfProps = {
  items: QrLabelPdfItem[];
  format: AveryLabelFormat;
  companyName: string;
};

function truncateText(text: string, maxChars: number): string {
  const s = text.trim();
  if (s.length <= maxChars) return s;
  return `${s.slice(0, Math.max(0, maxChars - 1))}…`;
}

function labelPosition(spec: AveryLabelSpec, indexOnPage: number) {
  const col = indexOnPage % spec.cols;
  const row = Math.floor(indexOnPage / spec.cols);
  const left = spec.marginLeftMm + col * (spec.labelWidthMm + spec.gapHorizontalMm);
  const top = spec.marginTopMm + row * (spec.labelHeightMm + spec.gapVerticalMm);
  return { left, top };
}

function LabelCell({
  item,
  spec,
  indexOnPage,
  companyName,
}: {
  item: QrLabelPdfItem;
  spec: AveryLabelSpec;
  indexOnPage: number;
  companyName: string;
}) {
  const { left, top } = labelPosition(spec, indexOnPage);
  const pad = 1.5;
  const isVertical = spec.layout === "vertical";

  const nameSize = isVertical ? 8 : 7;
  const modelSize = isVertical ? 6 : 5;
  const nameMax = isVertical ? 28 : spec.labelWidthMm > 80 ? 42 : 22;
  const modelMax = isVertical ? 24 : 18;

  const textBlockMm = isVertical ? 11 : 0;
  const qrSideMm = isVertical
    ? Math.min(spec.labelWidthMm - pad * 2, spec.labelHeightMm - textBlockMm - pad * 2)
    : Math.min(spec.labelHeightMm - pad * 2, spec.labelWidthMm * 0.42);

  const qrLeft = left + pad;
  const qrTop = top + pad;
  const textLeft = isVertical ? left + pad : left + pad + qrSideMm + 1.5;
  const textTop = isVertical ? top + pad + qrSideMm + 1 : top + pad;
  const textWidth = isVertical ? spec.labelWidthMm - pad * 2 : spec.labelWidthMm - qrSideMm - pad * 3;

  return (
    <View
      style={{
        position: "absolute",
        left: `${left}mm`,
        top: `${top}mm`,
        width: `${spec.labelWidthMm}mm`,
        height: `${spec.labelHeightMm}mm`,
      }}
    >
      <Image
        src={item.qrDataUrl}
        style={{
          position: "absolute",
          left: `${qrLeft - left}mm`,
          top: `${qrTop - top}mm`,
          width: `${qrSideMm}mm`,
          height: `${qrSideMm}mm`,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: `${textLeft - left}mm`,
          top: `${textTop - top}mm`,
          width: `${textWidth}mm`,
        }}
      >
        <Text style={{ fontSize: nameSize, fontFamily: "Helvetica-Bold" }}>
          {truncateText(item.name, nameMax)}
        </Text>
        {item.model ? (
          <Text style={{ fontSize: modelSize, fontFamily: "Helvetica", marginTop: 1 }}>
            {truncateText(item.model, modelMax)}
          </Text>
        ) : null}
      </View>
      {companyName ? (
        <Text
          style={{
            position: "absolute",
            right: `${pad}mm`,
            bottom: `${pad}mm`,
            fontSize: 4.5,
            fontFamily: "Helvetica",
            color: "#666666",
            maxWidth: `${spec.labelWidthMm - pad * 2}mm`,
          }}
        >
          {truncateText(companyName, 18)}
        </Text>
      ) : null}
    </View>
  );
}

export function QrLabelsPdf({ items, format, companyName }: QrLabelsPdfProps) {
  const spec = AVERY_LABEL_SPECS[format];
  const perPage = labelsPerPage(format);
  const pages = chunkItems(items, perPage);

  return (
    <Document>
      {pages.map((pageItems, pageIdx) => (
        <Page key={`page-${pageIdx}`} size={spec.pageSize} style={styles.page}>
          {pageItems.map((item, idx) => (
            <LabelCell
              key={item.id}
              item={item}
              spec={spec}
              indexOnPage={idx}
              companyName={companyName}
            />
          ))}
        </Page>
      ))}
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: "Helvetica",
  },
});

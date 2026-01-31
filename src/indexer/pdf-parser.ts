// Use legacy build for Node.js environment
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api.js';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';

export interface ParsedPage {
  pageNumber: number;
  text: string;
  lines: string[];
}

export interface ParsedPDF {
  filename: string;
  hash: string;
  pageCount: number;
  pages: ParsedPage[];
}

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return 'str' in item;
}

export async function parsePDF(filePath: string): Promise<ParsedPDF> {
  const absolutePath = path.resolve(filePath);
  const fileBuffer = await readFile(absolutePath);
  const hash = createHash('md5').update(fileBuffer).digest('hex');

  const data = new Uint8Array(fileBuffer);
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
  }).promise;

  const pages: ParsedPage[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of textContent.items) {
      if (!isTextItem(item)) continue;

      const y = item.transform[5];

      if (lastY !== null && Math.abs(y - lastY) > 5) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = item.str;
      } else {
        currentLine += item.str;
      }
      lastY = y;
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    pages.push({
      pageNumber: pageNum,
      text: lines.join('\n'),
      lines,
    });
  }

  return {
    filename: path.basename(filePath),
    hash,
    pageCount: doc.numPages,
    pages,
  };
}

export async function getPageText(filePath: string, pageNumber: number): Promise<string> {
  const fileBuffer = await readFile(filePath);
  const data = new Uint8Array(fileBuffer);
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
  }).promise;

  if (pageNumber < 1 || pageNumber > doc.numPages) {
    throw new Error(`Invalid page number: ${pageNumber}. Document has ${doc.numPages} pages.`);
  }

  const page = await doc.getPage(pageNumber);
  const textContent = await page.getTextContent();

  const lines: string[] = [];
  let currentLine = '';
  let lastY: number | null = null;

  for (const item of textContent.items) {
    if (!isTextItem(item)) continue;

    const y = item.transform[5];

    if (lastY !== null && Math.abs(y - lastY) > 5) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      currentLine = item.str;
    } else {
      currentLine += item.str;
    }
    lastY = y;
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines.join('\n');
}

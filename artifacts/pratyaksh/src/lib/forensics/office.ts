// Office Open XML forensics. DOCX / XLSX / PPTX are ZIP containers.
// We crack the zip, read core/app metadata, and detect macros (vbaProject.bin).
import JSZip from "jszip";

export interface OfficeAnalysis {
  isOffice: boolean;
  format?: "docx" | "xlsx" | "pptx" | "unknown-ooxml";
  title?: string;
  creator?: string;
  lastModifiedBy?: string;
  revision?: string;
  created?: string;
  modified?: string;
  application?: string;
  appVersion?: string;
  company?: string;
  template?: string;
  totalEditingTime?: string;
  pages?: string;
  words?: string;
  characters?: string;
  hasMacros: boolean;
  macroFiles: string[];
  embeddedObjectCount: number;
  hyperlinkCount: number;
  externalRelationships: string[];
  notes: string[];
}

function getXmlValue(xml: string, tag: string): string | undefined {
  // Match <ns:tag>value</ns:tag> or <tag>value</tag>
  const re = new RegExp(
    `<(?:[a-zA-Z0-9]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tag}>`,
  );
  const m = xml.match(re);
  if (!m) return undefined;
  return m[1].trim() || undefined;
}

export async function analyzeOffice(file: File): Promise<OfficeAnalysis> {
  const notes: string[] = [];
  const buf = await file.arrayBuffer();

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch (e) {
    return {
      isOffice: false,
      hasMacros: false,
      macroFiles: [],
      embeddedObjectCount: 0,
      hyperlinkCount: 0,
      externalRelationships: [],
      notes: [`Not a ZIP-based document: ${e instanceof Error ? e.message : "unknown"}`],
    };
  }

  // Detect format by checking the [Content_Types].xml
  const ctFile = zip.file("[Content_Types].xml");
  if (!ctFile) {
    return {
      isOffice: false,
      hasMacros: false,
      macroFiles: [],
      embeddedObjectCount: 0,
      hyperlinkCount: 0,
      externalRelationships: [],
      notes: ["ZIP archive but missing [Content_Types].xml — not Office Open XML"],
    };
  }

  const ct = await ctFile.async("string");
  let format: OfficeAnalysis["format"] = "unknown-ooxml";
  if (ct.includes("wordprocessingml")) format = "docx";
  else if (ct.includes("spreadsheetml")) format = "xlsx";
  else if (ct.includes("presentationml")) format = "pptx";

  const result: OfficeAnalysis = {
    isOffice: true,
    format,
    hasMacros: false,
    macroFiles: [],
    embeddedObjectCount: 0,
    hyperlinkCount: 0,
    externalRelationships: [],
    notes,
  };

  // core.xml — Dublin Core metadata
  const coreFile = zip.file("docProps/core.xml");
  if (coreFile) {
    const xml = await coreFile.async("string");
    result.title = getXmlValue(xml, "title");
    result.creator = getXmlValue(xml, "creator");
    result.lastModifiedBy = getXmlValue(xml, "lastModifiedBy");
    result.revision = getXmlValue(xml, "revision");
    result.created = getXmlValue(xml, "created");
    result.modified = getXmlValue(xml, "modified");
  } else {
    notes.push("docProps/core.xml not present");
  }

  // app.xml — application metadata
  const appFile = zip.file("docProps/app.xml");
  if (appFile) {
    const xml = await appFile.async("string");
    result.application = getXmlValue(xml, "Application");
    result.appVersion = getXmlValue(xml, "AppVersion");
    result.company = getXmlValue(xml, "Company");
    result.template = getXmlValue(xml, "Template");
    result.totalEditingTime = getXmlValue(xml, "TotalTime");
    result.pages = getXmlValue(xml, "Pages");
    result.words = getXmlValue(xml, "Words");
    result.characters = getXmlValue(xml, "Characters");
  }

  // Macro detection — vbaProject.bin lives at word/, xl/, or ppt/
  const macroFiles: string[] = [];
  zip.forEach((relPath, _entry) => {
    if (/vbaProject\.bin$/i.test(relPath)) macroFiles.push(relPath);
  });
  result.hasMacros = macroFiles.length > 0;
  result.macroFiles = macroFiles;
  if (result.hasMacros) {
    notes.push(
      `MACRO PAYLOAD detected: ${macroFiles.join(", ")} — VBA code present, treat with caution.`,
    );
  }

  // Embedded objects (oleObjects, embeddings)
  let embeddedCount = 0;
  zip.forEach((relPath, _entry) => {
    if (/embeddings\//i.test(relPath) || /oleObject\d/i.test(relPath))
      embeddedCount++;
  });
  result.embeddedObjectCount = embeddedCount;
  if (embeddedCount > 0)
    notes.push(`${embeddedCount} embedded OLE object(s) — examine for payloads.`);

  // External relationships (hyperlinks, remote includes) — found in *.rels files
  let hyperlinks = 0;
  const externalRels: string[] = [];
  const relsFiles = zip.file(/\.rels$/);
  for (const rf of relsFiles) {
    const xml = await rf.async("string");
    const targetMatches = xml.matchAll(/Target="([^"]+)"\s+TargetMode="External"/gi);
    for (const m of targetMatches) {
      externalRels.push(m[1]);
      if (/^https?:|^ftp:|^mailto:/i.test(m[1])) hyperlinks++;
    }
  }
  result.hyperlinkCount = hyperlinks;
  result.externalRelationships = externalRels.slice(0, 50);
  if (externalRels.length > 0)
    notes.push(`${externalRels.length} external reference(s) (hyperlinks / remote content).`);

  if (result.lastModifiedBy && result.creator && result.lastModifiedBy !== result.creator)
    notes.push(
      `Author and last modifier differ — original "${result.creator}" → modified by "${result.lastModifiedBy}".`,
    );

  return result;
}

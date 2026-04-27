// Metadata extraction. Uses exifr for image EXIF/XMP/IPTC; other types
// get their basic file metadata (size, mtime, type).
import exifr from "exifr";

export interface FileMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  encoding: string;
  permissions: string;
  owner: string;
  group: string;
  created: string;
  modified: string;
  accessed: string;
}

export interface ImageMetadata {
  hasExif: boolean;
  make?: string;
  model?: string;
  software?: string;
  dateTimeOriginal?: string;
  modifyDate?: string;
  imageWidth?: number;
  imageHeight?: number;
  orientation?: number;
  iso?: number;
  fNumber?: number;
  exposureTime?: string;
  focalLength?: number;
  geolocation?: { lat: number; lng: number; alt?: number };
  xmpKeys?: string[];
  iptcKeys?: string[];
  rawKeys: string[];
  notes: string[];
}

export function basicFileMetadata(file: File): FileMetadata {
  // Browsers cannot expose owner/group/permissions/atime — those require
  // server-side stat(). We return the values that ARE truthful client-side.
  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || "application/octet-stream",
    mimeType: file.type || "application/octet-stream",
    encoding: "binary",
    permissions: "(server-side metadata required)",
    owner: "(server-side metadata required)",
    group: "(server-side metadata required)",
    // Browsers do not expose true creation time — we mirror the file's
    // lastModified as the best available proxy and keep the timestamp valid
    // (ISO 8601) so the UI never renders "Invalid Date".
    created: new Date(file.lastModified).toISOString(),
    modified: new Date(file.lastModified).toISOString(),
    accessed: "(unavailable in browser)",
  };
}

export async function extractImageMetadata(
  file: File,
): Promise<ImageMetadata> {
  const notes: string[] = [];
  try {
    const parsed = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: true,
      iptc: true,
      icc: false,
      ifd1: true,
      mergeOutput: true,
      sanitize: true,
      reviveValues: true,
    });

    if (!parsed) {
      notes.push("No EXIF/XMP/IPTC metadata present in image");
      return { hasExif: false, rawKeys: [], notes };
    }

    const rawKeys = Object.keys(parsed).sort();
    const result: ImageMetadata = {
      hasExif: true,
      rawKeys,
      notes,
      make: parsed.Make,
      model: parsed.Model,
      software: parsed.Software,
      dateTimeOriginal: parsed.DateTimeOriginal
        ? new Date(parsed.DateTimeOriginal).toISOString()
        : undefined,
      modifyDate: parsed.ModifyDate
        ? new Date(parsed.ModifyDate).toISOString()
        : undefined,
      imageWidth: parsed.ImageWidth || parsed.ExifImageWidth,
      imageHeight: parsed.ImageHeight || parsed.ExifImageHeight,
      orientation: parsed.Orientation,
      iso: parsed.ISO,
      fNumber: parsed.FNumber,
      exposureTime:
        typeof parsed.ExposureTime === "number"
          ? parsed.ExposureTime < 1
            ? `1/${Math.round(1 / parsed.ExposureTime)}s`
            : `${parsed.ExposureTime}s`
          : undefined,
      focalLength: parsed.FocalLength,
    };

    if (parsed.latitude && parsed.longitude) {
      result.geolocation = {
        lat: parsed.latitude,
        lng: parsed.longitude,
        alt: parsed.GPSAltitude,
      };
      notes.push("GPS coordinates embedded in EXIF — privacy-sensitive");
    }

    if (parsed.Software) {
      notes.push(`Created/edited with: ${parsed.Software}`);
      const editors = ["Photoshop", "GIMP", "Lightroom", "Affinity"];
      if (editors.some((e) => String(parsed.Software).includes(e))) {
        notes.push(
          "Image was processed in a photo editor — original may differ",
        );
      }
    }

    if (parsed.DateTimeOriginal && parsed.ModifyDate) {
      const orig = new Date(parsed.DateTimeOriginal).getTime();
      const mod = new Date(parsed.ModifyDate).getTime();
      if (mod - orig > 60_000) {
        notes.push(
          `Modify date is ${Math.round(
            (mod - orig) / 1000,
          )}s after original — image was edited`,
        );
      }
    }

    return result;
  } catch (err) {
    notes.push(
      `EXIF parse failed: ${err instanceof Error ? err.message : "unknown"}`,
    );
    return { hasExif: false, rawKeys: [], notes };
  }
}

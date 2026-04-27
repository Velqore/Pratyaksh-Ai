// Lightweight PE/ELF header parsing. We don't try to match a full PE parser —
// just enough to extract characteristics that matter for triage.

export interface PEInfo {
  isPE: boolean;
  machine?: string;
  numberOfSections?: number;
  timeDateStamp?: string;
  characteristics?: string[];
  imports?: string[];
  importCount?: number;
  isDLL?: boolean;
  is32Bit?: boolean;
  is64Bit?: boolean;
  notes: string[];
}

const MACHINE_TYPES: Record<number, string> = {
  0x014c: "x86 (i386)",
  0x8664: "x86_64 (AMD64)",
  0x01c0: "ARM",
  0xaa64: "ARM64",
  0x0200: "Itanium (IA64)",
};

function readU16LE(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}
function readU32LE(b: Uint8Array, o: number): number {
  return (
    (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
  );
}

export async function analyzePE(file: File): Promise<PEInfo> {
  const headerBuf = await file.slice(0, 4096).arrayBuffer();
  const b = new Uint8Array(headerBuf);
  const notes: string[] = [];

  if (b.length < 0x40 || b[0] !== 0x4d || b[1] !== 0x5a) {
    return { isPE: false, notes: ["Not a Windows PE/COFF file (no MZ header)"] };
  }

  const peOffset = readU32LE(b, 0x3c);
  if (peOffset + 24 > b.length) {
    return { isPE: false, notes: ["PE header offset out of range"] };
  }

  if (
    b[peOffset] !== 0x50 ||
    b[peOffset + 1] !== 0x45 ||
    b[peOffset + 2] !== 0x00 ||
    b[peOffset + 3] !== 0x00
  ) {
    return { isPE: false, notes: ["Missing PE\\0\\0 signature"] };
  }

  const coffOffset = peOffset + 4;
  const machineCode = readU16LE(b, coffOffset);
  const numberOfSections = readU16LE(b, coffOffset + 2);
  const timeDateStamp = readU32LE(b, coffOffset + 4);
  const characteristics = readU16LE(b, coffOffset + 18);
  const optHeaderSize = readU16LE(b, coffOffset + 16);

  const charFlags: string[] = [];
  if (characteristics & 0x0002) charFlags.push("EXECUTABLE_IMAGE");
  if (characteristics & 0x2000) charFlags.push("DLL");
  if (characteristics & 0x0020) charFlags.push("LARGE_ADDRESS_AWARE");
  if (characteristics & 0x0100) charFlags.push("32BIT_MACHINE");

  const isDLL = (characteristics & 0x2000) !== 0;
  const is32 = machineCode === 0x014c || (characteristics & 0x0100) !== 0;
  const is64 = machineCode === 0x8664 || machineCode === 0xaa64;

  // Optional header magic tells us PE32 vs PE32+
  const optHeaderOffset = coffOffset + 20;
  if (optHeaderOffset + 2 < b.length) {
    const magic = readU16LE(b, optHeaderOffset);
    if (magic === 0x10b) notes.push("Optional header: PE32 (32-bit)");
    else if (magic === 0x20b) notes.push("Optional header: PE32+ (64-bit)");
  }

  notes.push(`Compiled at: ${new Date(timeDateStamp * 1000).toUTCString()}`);
  notes.push(`Number of sections: ${numberOfSections}`);
  notes.push(`Optional header size: ${optHeaderSize} bytes`);

  return {
    isPE: true,
    machine: MACHINE_TYPES[machineCode] || `Unknown (0x${machineCode.toString(16)})`,
    numberOfSections,
    timeDateStamp: new Date(timeDateStamp * 1000).toISOString(),
    characteristics: charFlags,
    isDLL,
    is32Bit: is32,
    is64Bit: is64,
    notes,
  };
}

export interface ELFInfo {
  isELF: boolean;
  bitness?: 32 | 64;
  endianness?: "little" | "big";
  type?: string;
  machine?: string;
  notes: string[];
}

const ELF_TYPES: Record<number, string> = {
  1: "Relocatable",
  2: "Executable",
  3: "Shared object",
  4: "Core dump",
};

const ELF_MACHINES: Record<number, string> = {
  3: "x86 (i386)",
  62: "x86_64",
  40: "ARM",
  183: "ARM64 (AArch64)",
  243: "RISC-V",
};

export async function analyzeELF(file: File): Promise<ELFInfo> {
  const buf = await file.slice(0, 64).arrayBuffer();
  const b = new Uint8Array(buf);
  if (
    b.length < 20 ||
    b[0] !== 0x7f ||
    b[1] !== 0x45 ||
    b[2] !== 0x4c ||
    b[3] !== 0x46
  ) {
    return { isELF: false, notes: ["Not an ELF file"] };
  }
  const bitness = b[4] === 1 ? 32 : 64;
  const endianness: "little" | "big" = b[5] === 1 ? "little" : "big";
  const type =
    endianness === "little"
      ? readU16LE(b, 16)
      : (b[16] << 8) | b[17];
  const machine =
    endianness === "little"
      ? readU16LE(b, 18)
      : (b[18] << 8) | b[19];

  return {
    isELF: true,
    bitness,
    endianness,
    type: ELF_TYPES[type] || `Unknown (${type})`,
    machine: ELF_MACHINES[machine] || `Unknown (${machine})`,
    notes: [
      `${bitness}-bit ${endianness}-endian ELF`,
      `Type: ${ELF_TYPES[type] || type}`,
      `Architecture: ${ELF_MACHINES[machine] || machine}`,
    ],
  };
}

import { PDFDocument, PDFHeader } from "@cantoo/pdf-lib";
import { loadPdf, savePdf } from "@editor/services/pdfEdit/common";

/** The "prevent ..." switches of the Add Password and Change Permissions tools. */
export interface PermissionRestrictions {
  preventAssembly?: boolean;
  preventExtractContent?: boolean;
  preventExtractForAccessibility?: boolean;
  preventFillInForm?: boolean;
  preventModify?: boolean;
  preventModifyAnnotations?: boolean;
  preventPrinting?: boolean;
  preventPrintingFaithful?: boolean;
}

export interface EncryptionSettings {
  /** Password to open the document; empty for none. */
  password?: string;
  /** Password that lifts the restrictions; empty to generate an unknown one. */
  ownerPassword?: string;
  /** 40 (RC4), 128 (AES) or 256 (AES). */
  keyLength?: number;
  restrictions?: PermissionRestrictions;
}

// pdf-lib picks the cipher from the document's PDF version: 1.3 -> RC4 40-bit,
// 1.7 -> AES-128, "1.7ext3" (Adobe extension level 3) -> AES-256.
const CIPHER_LEVEL: Record<number, string> = {
  40: "1.3",
  128: "1.7",
  256: "1.7ext3",
};

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const hasRestrictions = (r: PermissionRestrictions = {}): boolean => Object.values(r).some(Boolean);

/** Encrypts `doc` in place; call just before saving. */
export function encryptDocument(doc: PDFDocument, settings: EncryptionSettings): void {
  const { restrictions = {} } = settings;
  const userPassword = settings.password ?? "";
  let ownerPassword = settings.ownerPassword ?? "";
  if (!userPassword && !ownerPassword) {
    if (!hasRestrictions(restrictions)) {
      throw new Error("Enter a password or choose at least one restriction.");
    }
    // Restrictions need an owner password to be enforceable; like a PDF library
    // given none, use one nobody knows.
    ownerPassword = randomPassword();
  }

  const level = CIPHER_LEVEL[settings.keyLength ?? 128];
  if (!level) throw new Error(`Unsupported key length ${settings.keyLength}.`);

  // The AES ciphers need a PDF 1.7 file header.
  if (level !== "1.3") doc.context.header = PDFHeader.forVersion(1, 7);
  const header = doc.context.header;
  const writtenVersion = header.getVersionString.bind(header);
  // PDFSecurity reads the version string once, in encrypt(), to choose the cipher.
  header.getVersionString = () => level;
  try {
    doc.encrypt({
      userPassword,
      ownerPassword,
      permissions: {
        printing: restrictions.preventPrinting
          ? false
          : restrictions.preventPrintingFaithful
            ? "lowResolution"
            : "highResolution",
        modifying: !restrictions.preventModify,
        copying: !restrictions.preventExtractContent,
        annotating: !restrictions.preventModifyAnnotations,
        fillingForms: !restrictions.preventFillInForm,
        contentAccessibility: !restrictions.preventExtractForAccessibility,
        documentAssembly: !restrictions.preventAssembly,
      },
    });
  } finally {
    header.getVersionString = writtenVersion;
  }
}

/** Password-protects and/or restricts each file. Input files must not already be encrypted. */
export async function encryptPdfs(settings: EncryptionSettings, files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    encryptDocument(doc, settings);
    out.push(await savePdf(doc, file.name));
  }
  return out;
}

/**
 * Saves each file without any encryption. Tries the supplied passwords (opening password,
 * then permissions password) and finally the empty one, which opens PDFs that only
 * carry a permissions password.
 */
export async function decryptPdfs(passwords: (string | undefined)[], files: File[]): Promise<File[]> {
  const candidates = [...new Set([...passwords.filter((p): p is string => !!p), ""])];
  const out: File[] = [];
  for (const file of files) {
    let doc: PDFDocument | undefined;
    // An unencrypted file loads without a password and is returned as it is.
    const plain = await tryLoad(file, undefined);
    if (plain && !plain.isEncrypted) {
      out.push(file);
      continue;
    }
    for (const password of candidates) {
      doc = await tryLoad(file, password);
      if (doc) break;
    }
    if (!doc) throw new Error(`The password for ${file.name} is incorrect.`);
    out.push(await savePdf(doc, file.name));
  }
  return out;
}

async function tryLoad(file: File, password: string | undefined): Promise<PDFDocument | undefined> {
  try {
    return await loadPdf(file, { password, ignoreEncryption: true });
  } catch {
    return undefined;
  }
}

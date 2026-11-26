import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName, PDFNumber } from "@cantoo/pdf-lib";
import { decryptPdfs, encryptPdfs } from "./security";
import { makePdf, open, widths } from "./testPdf";

/** The /Encrypt dictionary entry `key` as a number, read without decrypting. */
async function encryptionEntry(file: File, key: string): Promise<number> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const dict = doc.context.lookup(doc.context.trailerInfo.Encrypt, PDFDict);
  return (dict.lookup(PDFName.of(key), PDFNumber) as PDFNumber).asNumber();
}

const isEncrypted = async (file: File) =>
  (
    await PDFDocument.load(await file.arrayBuffer(), {
      ignoreEncryption: true,
      updateMetadata: false,
    })
  ).isEncrypted;

describe("encryptPdfs", () => {
  it("needs the password to open, and keeps the pages", async () => {
    const [out] = await encryptPdfs({ password: "open-sesame" }, [
      await makePdf(3, "p.pdf"),
    ]);
    expect(out.name).toBe("p.pdf");
    expect(await isEncrypted(out)).toBe(true);
    await expect(open(out)).rejects.toThrow();
    expect(await widths(out).catch(() => null)).toBeNull();
    const doc = await open(out, "open-sesame");
    expect(doc.getPageCount()).toBe(3);
  });

  it.each([
    [40, 1, 2],
    [128, 4, 4],
    [256, 5, 5],
  ])("key length %i uses encryption V%i R%i", async (keyLength, v, r) => {
    const [out] = await encryptPdfs({ password: "pw", keyLength }, [
      await makePdf(1),
    ]);
    expect(await encryptionEntry(out, "V")).toBe(v);
    expect(await encryptionEntry(out, "R")).toBe(r);
    expect((await open(out, "pw")).getPageCount()).toBe(1);
  });

  it("accepts an owner password alone and opens with an empty password", async () => {
    const [out] = await encryptPdfs({ ownerPassword: "boss" }, [
      await makePdf(2),
    ]);
    expect(await isEncrypted(out)).toBe(true);
    expect((await open(out, "")).getPageCount()).toBe(2);
  });

  it("stores the restrictions in the permission flags", async () => {
    const flags = async (restrictions: object) => {
      const [out] = await encryptPdfs(
        { password: "u", ownerPassword: "o", restrictions },
        [await makePdf(1)],
      );
      return (await encryptionEntry(out, "P")) >>> 0;
    };
    const bit = (n: number) => 1 << (n - 1);
    const open_ = await flags({});
    const locked = await flags({
      preventPrinting: true,
      preventModify: true,
      preventExtractContent: true,
      preventModifyAnnotations: true,
      preventFillInForm: true,
      preventExtractForAccessibility: true,
      preventAssembly: true,
    });
    for (const n of [3, 4, 5, 6, 9, 10, 11]) {
      expect(open_ & bit(n)).toBeTruthy();
      expect(locked & bit(n)).toBe(0);
    }
    // Faithful printing is its own bit (12); plain printing (3) stays allowed.
    const lowPrint = await flags({ preventPrintingFaithful: true });
    expect(lowPrint & bit(3)).toBeTruthy();
    expect(lowPrint & bit(12)).toBe(0);
  });

  it("restrictions without any password get an unknown owner password", async () => {
    const [out] = await encryptPdfs(
      { restrictions: { preventPrinting: true } },
      [await makePdf(1)],
    );
    expect(await isEncrypted(out)).toBe(true);
    expect((await open(out, "")).getPageCount()).toBe(1);
  });

  it("refuses to run with nothing to apply", async () => {
    await expect(encryptPdfs({}, [await makePdf(1)])).rejects.toThrow(
      /password or choose/,
    );
  });

  it("rejects an already protected input", async () => {
    const [locked] = await encryptPdfs({ password: "x" }, [await makePdf(1)]);
    await expect(encryptPdfs({ password: "y" }, [locked])).rejects.toThrow(
      /password protected/,
    );
  });
});

describe("decryptPdfs", () => {
  it("removes the opening password", async () => {
    const [locked] = await encryptPdfs({ password: "secret" }, [
      await makePdf(2, "l.pdf"),
    ]);
    const [out] = await decryptPdfs(["secret"], [locked]);
    expect(out.name).toBe("l.pdf");
    expect(await isEncrypted(out)).toBe(false);
    expect(await widths(out)).toEqual([100, 101]);
  });

  it("works with AES-256 and RC4 documents too", async () => {
    for (const keyLength of [40, 256]) {
      const [locked] = await encryptPdfs({ password: "pw", keyLength }, [
        await makePdf(1),
      ]);
      const [out] = await decryptPdfs(["pw"], [locked]);
      expect(await isEncrypted(out)).toBe(false);
    }
  });

  it("tries the permissions password and removes owner-only restrictions", async () => {
    const [locked] = await encryptPdfs(
      { ownerPassword: "boss", restrictions: { preventPrinting: true } },
      [await makePdf(1)],
    );
    const [out] = await decryptPdfs(["", "boss"], [locked]);
    expect(await isEncrypted(out)).toBe(false);
  });

  it("fails with a wrong password", async () => {
    const [locked] = await encryptPdfs({ password: "right" }, [
      await makePdf(1, "w.pdf"),
    ]);
    await expect(decryptPdfs(["wrong"], [locked])).rejects.toThrow(
      /password for w\.pdf is incorrect/,
    );
  });

  it("passes an unprotected file through unchanged", async () => {
    const plain = await makePdf(1);
    const [out] = await decryptPdfs(["anything"], [plain]);
    expect(out).toBe(plain);
  });
});

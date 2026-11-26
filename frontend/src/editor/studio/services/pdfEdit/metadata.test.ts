import { describe, expect, it } from "vitest";
import { PDFDict, PDFName } from "@cantoo/pdf-lib";
import { changeMetadata, type MetadataEdit } from "./metadata";
import { makePdf, open } from "./testPdf";

const blank: MetadataEdit = {
  title: "",
  author: "",
  subject: "",
  keywords: "",
  creator: "",
  producer: "",
  creationDate: null,
  modificationDate: null,
  trapped: "Unknown",
  customMetadata: [],
  deleteAll: false,
};

const infoOf = (doc: Awaited<ReturnType<typeof open>>) => doc.context.lookup(doc.context.trailerInfo.Info, PDFDict);

describe("changeMetadata", () => {
  it("writes the standard fields, dates, trapped flag and custom entries", async () => {
    const created = new Date(Date.UTC(2020, 0, 2, 3, 4, 5));
    const modified = new Date(Date.UTC(2021, 5, 7, 8, 9, 10));
    const [out] = await changeMetadata(
      {
        ...blank,
        title: "Quarterly report",
        author: "Ada",
        subject: "Q3",
        keywords: "a b c",
        creator: "Me",
        producer: "Tool",
        creationDate: created,
        modificationDate: modified,
        trapped: "True",
        customMetadata: [
          { key: "Department", value: "Sales" },
          { key: "  ", value: "ignored" },
          { key: "Empty", value: "" },
        ],
      },
      [await makePdf(1, "m.pdf")],
    );
    const doc = await open(out);
    expect(doc.getTitle()).toBe("Quarterly report");
    expect(doc.getAuthor()).toBe("Ada");
    expect(doc.getSubject()).toBe("Q3");
    expect(doc.getKeywords()).toBe("a b c");
    expect(doc.getCreator()).toBe("Me");
    expect(doc.getProducer()).toBe("Tool");
    expect(doc.getCreationDate()?.getTime()).toBe(created.getTime());
    expect(doc.getModificationDate()?.getTime()).toBe(modified.getTime());

    const info = infoOf(doc);
    expect(info.get(PDFName.of("Trapped"))?.toString()).toBe("/True");
    expect(info.has(PDFName.of("Department"))).toBe(true);
    expect(info.has(PDFName.of("Empty"))).toBe(false);
  });

  it("treats the form as the full state: blank fields and unlisted custom keys go", async () => {
    const [first] = await changeMetadata(
      {
        ...blank,
        title: "Old",
        author: "Someone",
        customMetadata: [{ key: "Tag", value: "x" }],
      },
      [await makePdf(1)],
    );
    const [out] = await changeMetadata({ ...blank, title: "New" }, [first]);
    const doc = await open(out);
    expect(doc.getTitle()).toBe("New");
    expect(doc.getAuthor()).toBeUndefined();
    expect(infoOf(doc).has(PDFName.of("Tag"))).toBe(false);
  });

  it("deleteAll clears the info dictionary and XMP metadata", async () => {
    const [titled] = await changeMetadata({ ...blank, title: "T", author: "A" }, [await makePdf(1)]);
    const withXmp = await open(titled);
    withXmp.catalog.set(PDFName.of("Metadata"), withXmp.context.register(withXmp.context.stream("<xmp/>")));
    const file = new File([(await withXmp.save()) as BlobPart], "x.pdf", {
      type: "application/pdf",
    });

    const [out] = await changeMetadata({ ...blank, title: "ignored", deleteAll: true }, [file]);
    const doc = await open(out);
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getAuthor()).toBeUndefined();
    expect(doc.catalog.has(PDFName.of("Metadata"))).toBe(false);
  });
});

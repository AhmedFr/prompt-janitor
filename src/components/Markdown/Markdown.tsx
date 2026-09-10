import type { Block, MarkdownProps, Span } from "./Markdown.types";
import { parseBlocks, parseInline } from "./markdown.parse";
import "./Markdown.css";

/**
 * Renders the markdown a skill file is written in — read-only, and only ever
 * as React elements.
 *
 * There is no `dangerouslySetInnerHTML` anywhere in this component, and that
 * is the whole security story: a skill file is content the app found on disk
 * rather than content the app wrote, so `<img onerror=…>` inside one has to
 * come out as the eleven visible characters it is. Because the parser emits
 * data and this file emits elements, embedded markup has no route to becoming
 * markup — it lands in a text node like any other prose.
 *
 * Layout only. Everything about *what* the source means lives in
 * `markdown.parse.ts`.
 */
export function Markdown({ source }: MarkdownProps) {
  const blocks = parseBlocks(source);
  return (
    <div className="md">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "heading": {
      // `h1`-`h6` chosen by level, so the rendered document keeps the
      // outline the file's author wrote rather than a flattened one.
      const Tag = `h${block.level}` as const;
      return (
        <Tag className={`md__h md__h--${block.level}`}>
          <Inline text={block.text} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p className="md__p">
          <Inline text={block.text} />
        </p>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className="md__list">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case "code":
      // No inline pass: a code block's contents are the point, verbatim.
      // `data-lang` is presentational — there is no highlighter behind it,
      // it just lets the stylesheet label the block.
      return (
        <pre className="md__pre" data-lang={block.lang ?? undefined}>
          <code>{block.text}</code>
        </pre>
      );
    case "quote":
      return (
        <blockquote className="md__quote">
          <Inline text={block.text} />
        </blockquote>
      );
    case "hr":
      return <hr className="md__hr" />;
  }
}

/** One block's text, with its emphasis, code spans and links applied. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((span, i) => (
        <SpanView key={i} span={span} />
      ))}
    </>
  );
}

function SpanView({ span }: { span: Span }) {
  switch (span.kind) {
    case "text":
      return <>{span.text}</>;
    case "strong":
      return <strong>{span.text}</strong>;
    case "em":
      return <em>{span.text}</em>;
    case "code":
      return <code className="md__code">{span.text}</code>;
    case "link":
      // The parser has already refused every scheme but http/https/mailto
      // (see `safeHref`), so this href is safe to hand to an anchor as-is.
      // `noreferrer` because a skill file is not a page we vouch for.
      return (
        <a className="md__link" href={span.href} target="_blank" rel="noreferrer noopener">
          {span.text}
        </a>
      );
  }
}

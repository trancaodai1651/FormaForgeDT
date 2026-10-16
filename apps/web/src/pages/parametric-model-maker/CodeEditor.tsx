import { useEffect, useRef } from "react";
import { basicSetup, EditorView } from "codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { autocompletion } from "@codemirror/autocomplete";
const keywords =
  "cube sphere cylinder circle square polygon polyhedron union difference intersection hull minkowski translate rotate scale mirror color linear_extrude rotate_extrude offset resize text import surface include use module function for if else let assert echo children".split(
    " ",
  );
export function CodeEditor({
  value,
  onChange,
  onGenerate,
}: {
  value: string;
  onChange: (source: string) => void;
  onGenerate: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    editor = useRef<EditorView | null>(null),
    change = useRef(onChange),
    generate = useRef(onGenerate);
  change.current = onChange;
  generate.current = onGenerate;
  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      doc: value,
      parent: host.current,
      extensions: [
        basicSetup,
        cpp(),
        oneDark,
        keymap.of([
          indentWithTab,
          {
            key: "Mod-Enter",
            run: () => {
              generate.current();
              return true;
            },
          },
        ]),
        autocompletion({
          override: [
            (context) => {
              const word = context.matchBefore(/[\w$]*/);
              if (!word || (word.from === word.to && !context.explicit))
                return null;
              return {
                from: word.from,
                options: keywords.map((label) => ({ label, type: "keyword" })),
              };
            },
          ],
        }),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ "aria-label": "Mã OpenSCAD" }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) change.current(update.state.doc.toString());
        }),
      ],
    });
    editor.current = view;
    return () => {
      view.destroy();
      editor.current = null;
    };
  }, []);
  useEffect(() => {
    const view = editor.current;
    if (view && view.state.doc.toString() !== value)
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
  }, [value]);
  return <div className="pmm-code-editor" ref={host} />;
}

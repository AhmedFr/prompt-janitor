import { Card } from "@/components/Card";
import { AppTab } from "../AppTab";
import type { AboutTabProps } from "./AboutTab.types";

/** Settings → About: what's tracked and where it's stored, then version/updates/danger. */
export function AboutTab({ status }: AboutTabProps) {
  return (
    <>
      <h2 className="set-sec">About</h2>
      <Card>
        <div className="set-row">
          <span className="grow">Files tracked</span>
          <span className="faint tnum">{status?.file_count ?? "—"}</span>
        </div>
        <div className="set-row">
          <span className="grow">Storage</span>
          <span
            className="path faint"
            style={{
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {status?.db_path ?? "—"}
          </span>
        </div>
      </Card>
      <AppTab />
    </>
  );
}

import { useMemo } from "react";
import { ArtifactCard } from "@/components/ArtifactCard";
import { Card } from "@/components/Card";
import { applyFilter, groupByKind, kindHeading } from "../setup.util";
import { Heading } from "./Heading";
import type { KindSectionsProps } from "./KindSections.types";

/** The filtered artifacts of one layer, in one titled block per kind. */
export function KindSections({ artifacts, filter, costBar, level, navigate }: KindSectionsProps) {
  const groups = useMemo(
    () => groupByKind(applyFilter(artifacts, filter, costBar)),
    [artifacts, filter, costBar],
  );

  if (groups.length === 0) {
    return <p className="muted setup-kind__empty">Nothing matches this filter.</p>;
  }

  return (
    <>
      {groups.map(({ kind, items }) => (
        <div key={kind} className="setup-kind">
          <Heading level={level}>
            {kindHeading(kind)}{" "}
            <span className="setup-kind__count tnum">{items.length}</span>
          </Heading>
          <Card>
            <div className="setup-kind__list">
              {items.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  onOpen={(fileId) => navigate("detail", fileId)}
                />
              ))}
            </div>
          </Card>
        </div>
      ))}
    </>
  );
}

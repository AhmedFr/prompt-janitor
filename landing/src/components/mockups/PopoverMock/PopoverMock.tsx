import { BrushCleaningIcon } from "@/components/BrushCleaningIcon";

export function PopoverMock() {
  return (
    <div className="mk-pop-stage" aria-hidden="true">
      <div className="mk-pop">
        <div className="mk-pop-brand">
          <BrushCleaningIcon /> Prompt Janitor
        </div>
        <div className="mk-pop-grade">
          <div className="mk-ring sm">
            <span>B</span>
          </div>
          <div>
            <div className="mk-score">
              78<span>/100</span>
            </div>
            <div className="mk-lastscan">12 files · 3 critical</div>
          </div>
        </div>
        <div className="mk-lastscan">Last scan: 24 minutes ago</div>
        <span className="mk-scanbtn">Scan now</span>
      </div>
    </div>
  );
}

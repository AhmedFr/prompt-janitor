import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { MISSING_FOLDER_BODY, MISSING_FOLDER_TITLE } from "../Project.constants";
import "./StatePanel.css";

/**
 * The harness remembers this project and the disk has lost it. A live region
 * rather than plain text: the banner resolves in after the page has already
 * painted, and by then a reader on a screen reader is past the spot where it
 * appears.
 */
export function MissingFolderBanner() {
  return (
    <Card padded>
      <div className="project-banner" role="status">
        <Icon name="folder" size={16} />
        <div>
          <p className="project-banner__title">{MISSING_FOLDER_TITLE}</p>
          <p className="muted project-banner__body">{MISSING_FOLDER_BODY}</p>
        </div>
      </div>
    </Card>
  );
}

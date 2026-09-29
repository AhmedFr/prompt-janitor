import { useArtifactSource } from "../useArtifactSource";
import type { ItemViewerProps } from "./ItemViewer.types";
import { ItemViewerView } from "./ItemViewerView";
import { useGradedSource } from "./useGradedSource";

/**
 * Any Setup item — its file, its findings, its usage — in one sheet.
 *
 * All this does is join the file to the view. An inventory item reads (and
 * saves) through `useArtifactSource`; a graded file the inventory never saw
 * has no artifact id, so it reads through its file detail, read-only. Hooks
 * cannot be conditional, hence two thin components.
 */
export function ItemViewer(props: ItemViewerProps) {
  return props.item.origin === "graded" && props.item.file_id ? (
    <GradedItemViewer {...props} fileId={props.item.file_id} />
  ) : (
    <InventoryItemViewer {...props} />
  );
}

function InventoryItemViewer(props: ItemViewerProps) {
  return <ItemViewerView {...props} source={useArtifactSource(props.item.id)} />;
}

function GradedItemViewer({ fileId, ...props }: ItemViewerProps & { fileId: string }) {
  return <ItemViewerView {...props} source={useGradedSource(fileId)} />;
}

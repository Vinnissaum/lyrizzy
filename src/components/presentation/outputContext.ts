import { createContext, useContext } from "react";
import type { OutputId } from "../../types";

/**
 * The output (screen) a presentation subtree belongs to. Provided once at the
 * PresentationApp root so deep renderers (e.g. the camera/WebView renderer) can
 * read this window's output without prop-drilling through the slide tree.
 * Defaults to "one" so the operator's in-app previews behave as the primary output.
 */
export const OutputContext = createContext<OutputId>("one");

export const useOutputId = (): OutputId => useContext(OutputContext);

import React from "react";
import { WebViewRenderer } from "./WebViewRenderer";

interface Props {
  url: string;
}

export const QuickWebViewRenderer: React.FC<Props> = ({ url }) => {
  return <WebViewRenderer config={{ mode: "iframe", url }} />;
};

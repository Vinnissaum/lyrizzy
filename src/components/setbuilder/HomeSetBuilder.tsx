import React from "react";
import { useLibraryStore } from "../../stores/library";
import { SetBuilder } from "../set/SetBuilder";

export const HomeSetBuilder: React.FC = () => {
  const { fixedSetId } = useLibraryStore();

  if (!fixedSetId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Carregando…
      </div>
    );
  }

  return <SetBuilder setId={fixedSetId} />;
};

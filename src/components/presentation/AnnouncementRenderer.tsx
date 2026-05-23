import React from "react";

interface Props {
  text: string;
}

export const AnnouncementRenderer: React.FC<Props> = ({ text }) => {
  return (
    <div className="h-full bg-black flex items-center justify-center px-16 select-none">
      <p
        className="text-white text-center font-medium leading-relaxed"
        style={{ fontSize: "clamp(1.5rem, 4vw, 3rem)" }}
      >
        {text}
      </p>
    </div>
  );
};

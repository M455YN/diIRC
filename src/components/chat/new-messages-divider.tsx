import { useTranslation } from "react-i18next";
import { memo } from "react";

export const NewMessagesDivider = memo(() => {
  const { t: tr } = useTranslation();
  return (
    <div className="relative flex items-center my-3 select-none px-4 z-10">
      <div className="flex-grow h-[1px] bg-[#f23f43]/80 dark:bg-[#f23f43]/70" />
      <span className="flex items-center gap-1.5 bg-[#f23f43] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 shadow-sm ml-2">
        <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-pulse" />
        {tr("rest.newMessages")}
      </span>
    </div>
  );
});

NewMessagesDivider.displayName = "NewMessagesDivider";

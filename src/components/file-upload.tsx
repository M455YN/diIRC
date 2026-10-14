import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { FileIcon, UploadCloud, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMockStore } from "@/lib/mock-store";
import { uploadImage } from "@/lib/upload/services";
import { openExternalUrl } from "@/lib/system-utils";

interface FileUploadProps {
  onChange: (url?: string) => void;
  value: string;
  endpoint?: "messageFile" | "serverImage";
}

export const FileUpload = ({
  onChange,
  value,
}: FileUploadProps) => {
  const { t: tr } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadConfig = useMockStore((state) => state.uploadConfig);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileType = value?.split(".").pop()?.split("?")[0]?.toLowerCase();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (uploadConfig.provider !== "disabled") {
      try {
        setIsUploading(true);
        setErrorMsg(null);
        const remoteUrl = await uploadImage(file, uploadConfig);
        onChange(remoteUrl);
      } catch (err: any) {
        console.error("FileUpload error:", err);
        setErrorMsg(err?.message || "Upload failed");
        // Fallback to blob URL if upload fails so user can still see preview
        const localUrl = URL.createObjectURL(file);
        onChange(localUrl);
      } finally {
        setIsUploading(false);
      }
    } else {
      const localUrl = URL.createObjectURL(file);
      onChange(localUrl);
    }
  };

  if (isUploading) {
    return (
      <div className="border-2 border-dashed border-indigo-500 rounded-lg p-6 flex flex-col items-center justify-center bg-indigo-500/5">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-2" />
        <p className="text-xs font-semibold text-indigo-500">Uploading to {uploadConfig.provider}...</p>
      </div>
    );
  }

  if (value && fileType !== "pdf") {
    return (
      <div className="relative h-24 w-24 mx-auto">
        <img
          src={value}
          alt="Upload"
          className="rounded-full object-cover h-24 w-24 shadow-md border-2 border-indigo-500"
        />
        <button
          onClick={() => onChange("")}
          className="bg-rose-500 text-white p-1.5 rounded-full absolute top-0 right-0 shadow-sm hover:bg-rose-600 transition"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (value && fileType === "pdf") {
    return (
      <div className="relative flex items-center p-2 mt-2 rounded-md bg-background/10 border">
        <FileIcon className="h-10 w-10 fill-indigo-200 stroke-indigo-400" />
        <button 
          type="button"
          onClick={() => openExternalUrl(value)}
          className="ml-2 text-sm text-indigo-500 dark:text-indigo-400 hover:underline truncate max-w-[200px] text-left"
        >
          Attachment.pdf
        </button>
        <button
          onClick={() => onChange("")}
          className="bg-rose-500 text-white p-1 rounded-full absolute -top-2 -right-2 shadow-sm"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div 
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition group bg-zinc-50 dark:bg-zinc-900/50 w-full"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="p-3 bg-indigo-500/10 rounded-full group-hover:bg-indigo-500/20 transition mb-2">
        <UploadCloud className="h-8 w-8 text-indigo-500" />
      </div>
      <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
        {tr("rest.chooseFileDrop")}
      </p>
      <p className="text-xs text-zinc-400 mt-1">
        PNG, JPG, GIF or PDF (Active Provider: {uploadConfig.provider})
      </p>
      {errorMsg && (
        <p className="text-xs text-rose-500 mt-1 font-semibold">⚠️ {errorMsg}</p>
      )}
      <Button 
        type="button" 
        variant="secondary" 
        size="sm" 
        className="mt-3 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        {tr("rest.selectFile")}
      </Button>
    </div>
  );
};

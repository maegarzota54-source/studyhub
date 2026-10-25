import { useEffect } from 'react';
import { Download, X } from 'lucide-react';
import FilePreview from '@/Components/FilePreview';

export default function FilePreviewModal({ item, onClose, downloadUrl }) {
    useEffect(() => {
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview of ${item.title ?? item.attachment_name}`}
        >
            <div
                className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
                    <h2 className="min-w-0 flex-1 truncate font-semibold text-[#0A1F44]">
                        {item.title ?? item.attachment_name}
                    </h2>
                    {downloadUrl && (
                        <a href={downloadUrl} className="inline-flex shrink-0 items-center gap-1 text-sm text-hunter-700 underline">
                            <Download size={14} aria-hidden="true" /> Download
                        </a>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close preview"
                        className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>
                <div className="min-h-0 overflow-auto bg-cool-100 p-3 sm:p-4">
                    <FilePreview item={item} url={item.preview_url} />
                </div>
            </div>
        </div>
    );
}

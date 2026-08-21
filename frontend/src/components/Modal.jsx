import { useEffect, useRef } from "react";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  isLoading = false,
  showFooter = true,
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeMap = {
    sm: "400px",
    md: "560px",
    lg: "720px",
    xl: "960px",
  };

  return (
    <div className="mu-modal-overlay" onClick={onClose}>
      <div 
        className="mu-modal" 
        style={{ maxWidth: sizeMap[size] || sizeMap.md }}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        <div className="mu-modal-header">
          <h3>{title}</h3>
          <button className="mu-modal-close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="mu-modal-body">{children}</div>
        {showFooter && (
          <div className="mu-modal-footer">
            <button className="mu-btn mu-btn-secondary" onClick={onClose}>
              {cancelText}
            </button>
            <button 
              className="mu-btn mu-btn-primary" 
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <i className="bi bi-arrow-repeat mu-animate-spin" />
                  Processing...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
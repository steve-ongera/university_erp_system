export default function LoadingSpinner({ size = "md", text = "Loading..." }) {
  const sizeMap = {
    sm: "1.5rem",
    md: "2.5rem",
    lg: "3.5rem",
  };

  return (
    <div className="mu-loader-container">
      <div className="mu-loader-spinner" style={{ fontSize: sizeMap[size] || sizeMap.md }}>
        <i className="bi bi-arrow-repeat mu-animate-spin" />
      </div>
      {text && <p className="mu-loader-text">{text}</p>}
    </div>
  );
}
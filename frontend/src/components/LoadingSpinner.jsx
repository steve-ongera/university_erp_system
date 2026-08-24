export default function LoadingSpinner({ size = "md", text = "Loading..." }) {
  const sizeMap = {
    sm: "24px",
    md: "40px",
    lg: "56px",
  };

  const spinnerSize = sizeMap[size] || sizeMap.md;

  return (
    <div className="mu-loader-container">
      <div 
        className="mu-loader-spinner-round" 
        style={{ 
          width: spinnerSize, 
          height: spinnerSize,
        }}
      />
      {text && <p className="mu-loader-text">{text}</p>}
    </div>
  );
}
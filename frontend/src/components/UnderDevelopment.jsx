import { Link } from "react-router-dom";

export default function UnderDevelopment({ 
  title, 
  description = "This feature is currently under development. We're working hard to bring it to you soon!",
  icon = "bi-tools",
  estimatedRelease = "Coming soon"
}) {
  return (
    <div className="mu-under-development">
      <div className="mu-under-dev-icon">
        <i className={`bi ${icon}`} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="mu-under-dev-badge">
        <i className="bi bi-clock" />
        <span>{estimatedRelease}</span>
      </div>
      <Link to="/dashboard" className="mu-btn mu-btn-outline-primary">
        <i className="bi bi-arrow-left" />
        Back to Dashboard
      </Link>
    </div>
  );
}
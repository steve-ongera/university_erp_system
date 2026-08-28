import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { libraryApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const COPY_STATUSES = ["available", "borrowed", "reserved", "lost", "damaged", "under_repair", "withdrawn"];

export default function LibraryCatalog() {
  const [subTab, setSubTab] = useState("books");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // shared search
  const [search, setSearch] = useState("");

  // categories
  const [categories, setCategories] = useState([]);
  const [catModal, setCatModal] = useState(null);

  // books
  const [books, setBooks] = useState([]);
  const [bookModal, setBookModal] = useState(null);

  // copies
  const [copies, setCopies] = useState([]);
  const [copyModal, setCopyModal] = useState(null);
  const [copyBookFilter, setCopyBookFilter] = useState("");

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data } = await libraryApi.categories();
      setCategories(data.results || data);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };
  const loadBooks = async () => {
    setLoading(true);
    try {
      const { data } = await libraryApi.books(search ? { search } : {});
      setBooks(data.results || data);
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };
  const loadCopies = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (copyBookFilter) params.book = copyBookFilter;
      const { data } = await libraryApi.copies(params);
      setCopies(data.results || data);
    } catch {
      setCopies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadBooks();
  }, []);

  useEffect(() => {
    setError("");
    setNotice("");
    if (subTab === "copies") loadCopies();
  }, [subTab]);

  const runSearch = (e) => {
    e.preventDefault();
    if (subTab === "books") loadBooks();
    if (subTab === "copies") loadCopies();
  };

  // ---- category CRUD ----
  const saveCategory = async (form) => {
    try {
      if (form.id) await libraryApi.updateCategory(form.id, form);
      else await libraryApi.createCategory(form);
      setCatModal(null);
      setNotice(" Category saved.");
      loadCategories();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not save category.");
    }
  };
  const deleteCategory = async (id) => {
    if (!window.confirm("Delete this category? Books keep their record but lose the category link.")) return;
    try {
      await libraryApi.deleteCategory(id);
      loadCategories();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not delete category.");
    }
  };

  // ---- book CRUD ----
  const saveBook = async (form) => {
    try {
      const payload = { ...form, category: form.category || null };
      if (form.id) await libraryApi.updateBook(form.id, payload);
      else await libraryApi.createBook(payload);
      setBookModal(null);
      setNotice(" Book saved.");
      loadBooks();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not save book.");
    }
  };
  const deleteBook = async (id) => {
    if (!window.confirm("Delete this book title? This cannot be undone.")) return;
    try {
      await libraryApi.deleteBook(id);
      loadBooks();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not delete book — it may have active loans.");
    }
  };

  // ---- copy CRUD ----
  const saveCopy = async (form) => {
    try {
      if (form.id) await libraryApi.updateCopy(form.id, form);
      else await libraryApi.createCopy(form);
      setCopyModal(null);
      setNotice(" Copy saved.");
      loadCopies();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not save copy.");
    }
  };
  const deleteCopy = async (id) => {
    if (!window.confirm("Delete this copy?")) return;
    try {
      await libraryApi.deleteCopy(id);
      loadCopies();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not delete copy — it may have loan history.");
    }
  };

  // Tabs configuration
  const tabs = [
    { key: "books", label: "Books", icon: "bi-journal-bookmark" },
    { key: "copies", label: "Copies", icon: "bi-files" },
    { key: "categories", label: "Categories", icon: "bi-tags" },
  ];

  if (loading && subTab === "copies") {
    return <LoadingSpinner text="Loading catalog..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-journal-bookmark" />
            Catalog
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Library <span className="separator">/</span> Catalog
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/library/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}
      {notice && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {notice}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--mu-border)", marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSubTab(tab.key)}
            style={{
              border: "none",
              borderBottom: subTab === tab.key ? "2px solid var(--mu-primary-500)" : "2px solid transparent",
              borderRadius: 0,
              background: "transparent",
              padding: "8px 16px",
              cursor: "pointer",
              color: subTab === tab.key ? "var(--mu-primary-500)" : "var(--mu-gray-500)",
              fontWeight: subTab === tab.key ? 600 : 400,
              fontSize: "var(--mu-font-size-sm)",
              transition: "all var(--mu-transition-fast)",
            }}
          >
            <i className={tab.icon} style={{ marginRight: 6 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Books Tab */}
      {subTab === "books" && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-journal-bookmark" style={{ marginRight: 8 }} />
              Books
            </h4>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="mu-badge mu-badge-primary">
                {books.length} Book(s)
              </span>
              <button className="mu-btn mu-btn-sm mu-btn-primary" onClick={() => setBookModal({})}>
                <i className="bi bi-plus-circle" />
                Add Book
              </button>
            </div>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {/* Search inside table */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--mu-border)", background: "var(--mu-gray-50)" }}>
              <form onSubmit={runSearch} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <div style={{ flex: "1 1 240px" }}>
                  <input
                    className="mu-input"
                    placeholder="Search title, author, ISBN"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button className="mu-btn mu-btn-outline-primary" type="submit">
                  <i className="bi bi-search" />
                  Search
                </button>
              </form>
            </div>

            {books.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-journal-bookmark" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Books Found</h3>
                <p style={{ margin: "8px 0 0" }}>Click "Add Book" to create one.</p>
              </div>
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Author(s)</th>
                      <th>Category</th>
                      <th style={{ textAlign: "center" }}>Copies</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.title}</strong>
                        </td>
                        <td>{b.authors}</td>
                        <td>
                          <span className="mu-badge mu-badge-info">
                            {b.category_detail?.name || "—"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="mu-badge mu-badge-success">
                            {b.available_copies} / {b.total_copies}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-outline-primary"
                              onClick={() => setBookModal(b)}
                            >
                              <i className="bi bi-pencil" />
                              Edit
                            </button>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-danger"
                              onClick={() => deleteBook(b.id)}
                            >
                              <i className="bi bi-trash" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {books.length > 0 && (
            <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
                Total: {books.length} book(s)
              </span>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
                Last updated: {new Date().toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Copies Tab */}
      {subTab === "copies" && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-files" style={{ marginRight: 8 }} />
              Copies
            </h4>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="mu-badge mu-badge-primary">
                {copies.length} Copy(ies)
              </span>
              <button className="mu-btn mu-btn-sm mu-btn-primary" onClick={() => setCopyModal({})}>
                <i className="bi bi-plus-circle" />
                Add Copy
              </button>
            </div>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {/* Search inside table */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--mu-border)", background: "var(--mu-gray-50)" }}>
              <form onSubmit={runSearch} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <div style={{ flex: "1 1 240px" }}>
                  <input
                    className="mu-input"
                    placeholder="Search accession no. / title"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button className="mu-btn mu-btn-outline-primary" type="submit">
                  <i className="bi bi-search" />
                  Search
                </button>
              </form>
            </div>

            {copies.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-files" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Copies Found</h3>
                <p style={{ margin: "8px 0 0" }}>Click "Add Copy" to create one.</p>
              </div>
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Accession #</th>
                      <th>Title</th>
                      <th>Shelf</th>
                      <th>Status</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {copies.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.accession_number}</strong>
                        </td>
                        <td>{books.find((b) => b.id === c.book)?.title || c.book}</td>
                        <td>{c.shelf_location || "—"}</td>
                        <td>
                          <span className={`mu-badge ${
                            c.status === "available" ? "mu-badge-success" :
                            c.status === "borrowed" ? "mu-badge-warning" :
                            c.status === "lost" ? "mu-badge-danger" :
                            c.status === "damaged" ? "mu-badge-danger" :
                            "mu-badge-gray"
                          }`}>
                            {c.status.replace("_", " ")}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-outline-primary"
                              onClick={() => setCopyModal(c)}
                            >
                              <i className="bi bi-pencil" />
                              Edit
                            </button>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-danger"
                              onClick={() => deleteCopy(c.id)}
                            >
                              <i className="bi bi-trash" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {copies.length > 0 && (
            <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
                Total: {copies.length} copy(ies)
              </span>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
                Last updated: {new Date().toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {subTab === "categories" && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-tags" style={{ marginRight: 8 }} />
              Categories
            </h4>
            <button className="mu-btn mu-btn-sm mu-btn-primary" onClick={() => setCatModal({})}>
              <i className="bi bi-plus-circle" />
              Add Category
            </button>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {categories.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-tags" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Categories</h3>
                <p style={{ margin: "8px 0 0" }}>Click "Add Category" to create one.</p>
              </div>
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                        </td>
                        <td>{c.description || "—"}</td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-outline-primary"
                              onClick={() => setCatModal(c)}
                            >
                              <i className="bi bi-pencil" />
                              Edit
                            </button>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-danger"
                              onClick={() => deleteCategory(c.id)}
                            >
                              <i className="bi bi-trash" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {categories.length > 0 && (
            <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
                Total: {categories.length} category(ies)
              </span>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
                Last updated: {new Date().toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Book Modal */}
      {bookModal && (
        <Modal
          isOpen={true}
          onClose={() => setBookModal(null)}
          title={bookModal.id ? "Edit Book" : "Add Book"}
          size="md"
          confirmText="Save"
          onConfirm={() => saveBook(bookModal)}
        >
          <div className="mu-form-group">
            <label>Title</label>
            <input
              className="mu-input"
              value={bookModal.title || ""}
              onChange={(e) => setBookModal({ ...bookModal, title: e.target.value })}
            />
          </div>
          <div className="mu-form-group">
            <label>Author(s)</label>
            <input
              className="mu-input"
              value={bookModal.authors || ""}
              onChange={(e) => setBookModal({ ...bookModal, authors: e.target.value })}
              placeholder="Comma-separated"
            />
          </div>
          <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
            <div className="mu-form-group">
              <label>ISBN</label>
              <input
                className="mu-input"
                value={bookModal.isbn || ""}
                onChange={(e) => setBookModal({ ...bookModal, isbn: e.target.value })}
              />
            </div>
            <div className="mu-form-group">
              <label>Publisher</label>
              <input
                className="mu-input"
                value={bookModal.publisher || ""}
                onChange={(e) => setBookModal({ ...bookModal, publisher: e.target.value })}
              />
            </div>
          </div>
          <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
            <div className="mu-form-group">
              <label>Edition</label>
              <input
                className="mu-input"
                value={bookModal.edition || ""}
                onChange={(e) => setBookModal({ ...bookModal, edition: e.target.value })}
              />
            </div>
            <div className="mu-form-group">
              <label>Publication Year</label>
              <input
                type="number"
                className="mu-input"
                value={bookModal.publication_year || ""}
                onChange={(e) => setBookModal({ ...bookModal, publication_year: e.target.value })}
              />
            </div>
          </div>
          <div className="mu-form-group">
            <label>Category</label>
            <select
              className="mu-select"
              value={bookModal.category || ""}
              onChange={(e) => setBookModal({ ...bookModal, category: e.target.value })}
            >
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="mu-form-group">
            <label>Description</label>
            <textarea
              className="mu-textarea"
              rows={3}
              value={bookModal.description || ""}
              onChange={(e) => setBookModal({ ...bookModal, description: e.target.value })}
            />
          </div>
        </Modal>
      )}

      {/* Copy Modal */}
      {copyModal && (
        <Modal
          isOpen={true}
          onClose={() => setCopyModal(null)}
          title={copyModal.id ? "Edit Copy" : "Add Copy"}
          size="md"
          confirmText="Save"
          onConfirm={() => saveCopy(copyModal)}
        >
          <div className="mu-form-group">
            <label>Book</label>
            <select
              className="mu-select"
              value={copyModal.book || ""}
              onChange={(e) => setCopyModal({ ...copyModal, book: e.target.value })}
            >
              <option value="">Select a title…</option>
              {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </div>
          <div className="mu-form-group">
            <label>Accession Number</label>
            <input
              className="mu-input"
              value={copyModal.accession_number || ""}
              onChange={(e) => setCopyModal({ ...copyModal, accession_number: e.target.value })}
            />
          </div>
          <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
            <div className="mu-form-group">
              <label>Shelf Location</label>
              <input
                className="mu-input"
                value={copyModal.shelf_location || ""}
                onChange={(e) => setCopyModal({ ...copyModal, shelf_location: e.target.value })}
              />
            </div>
            <div className="mu-form-group">
              <label>Status</label>
              <select
                className="mu-select"
                value={copyModal.status || "available"}
                onChange={(e) => setCopyModal({ ...copyModal, status: e.target.value })}
              >
                {COPY_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
          <div className="mu-form-group">
            <label>Condition Notes</label>
            <textarea
              className="mu-textarea"
              rows={2}
              value={copyModal.condition_notes || ""}
              onChange={(e) => setCopyModal({ ...copyModal, condition_notes: e.target.value })}
            />
          </div>
        </Modal>
      )}

      {/* Category Modal */}
      {catModal && (
        <Modal
          isOpen={true}
          onClose={() => setCatModal(null)}
          title={catModal.id ? "Edit Category" : "Add Category"}
          size="sm"
          confirmText="Save"
          onConfirm={() => saveCategory(catModal)}
        >
          <div className="mu-form-group">
            <label>Name</label>
            <input
              className="mu-input"
              value={catModal.name || ""}
              onChange={(e) => setCatModal({ ...catModal, name: e.target.value })}
            />
          </div>
          <div className="mu-form-group">
            <label>Description</label>
            <textarea
              className="mu-textarea"
              rows={2}
              value={catModal.description || ""}
              onChange={(e) => setCatModal({ ...catModal, description: e.target.value })}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
import { useEffect, useState } from "react";
import { libraryApi } from "../../services/api";
import LibraryNav from "./LibraryNav";
import "../../style/library.css";

const COPY_STATUSES = ["available", "borrowed", "reserved", "lost", "damaged", "under_repair", "withdrawn"];

function Modal({ title, onClose, children }) {
  return (
    <div className="lib-modal-backdrop" onClick={onClose}>
      <div className="lib-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function LibraryCatalog() {
  const [subTab, setSubTab] = useState("books");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // shared search
  const [search, setSearch] = useState("");

  // categories
  const [categories, setCategories] = useState([]);
  const [catModal, setCatModal] = useState(null); // {} = new, {...cat} = edit

  // books
  const [books, setBooks] = useState([]);
  const [bookModal, setBookModal] = useState(null);

  // copies
  const [copies, setCopies] = useState([]);
  const [copyModal, setCopyModal] = useState(null);
  const [copyBookFilter, setCopyBookFilter] = useState("");

  const loadCategories = async () => {
    const { data } = await libraryApi.categories();
    setCategories(data.results || data);
  };
  const loadBooks = async () => {
    const { data } = await libraryApi.books(search ? { search } : {});
    setBooks(data.results || data);
  };
  const loadCopies = async () => {
    const params = {};
    if (search) params.search = search;
    if (copyBookFilter) params.book = copyBookFilter;
    const { data } = await libraryApi.copies(params);
    setCopies(data.results || data);
  };

  useEffect(() => { loadCategories(); loadBooks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setError(""); setNotice("");
    if (subTab === "copies") loadCopies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setNotice("Category saved.");
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
      setNotice("Book saved.");
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
      setNotice("Copy saved.");
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

  return (
    <div className="lib-page">
      <div className="lib-header">
        <div>
          <h1 className="lib-title"><i className="bi bi-journal-bookmark" /> Catalog</h1>
          <p className="lib-subtitle">Manage titles, physical copies, and categories.</p>
        </div>
      </div>

      <LibraryNav />

      {error && <div className="lib-alert lib-alert-error">{error}</div>}
      {notice && <div className="lib-alert lib-alert-success">{notice}</div>}

      <div className="lib-tabs-inline">
        {["books", "copies", "categories"].map((t) => (
          <button key={t} className={`lib-tab-btn ${subTab === t ? "active" : ""}`} onClick={() => setSubTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {subTab === "books" && (
        <div className="lib-card">
          <div className="lib-toolbar">
            <form className="lib-toolbar-left" onSubmit={runSearch}>
              <input className="lib-input" placeholder="Search title, author, ISBN" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="lib-btn lib-btn-outline" type="submit">Search</button>
            </form>
            <button className="lib-btn lib-btn-primary" onClick={() => setBookModal({})}>
              <i className="bi bi-plus-lg" /> Add book
            </button>
          </div>
          <div className="lib-table-wrap">
            <table className="lib-table">
              <thead><tr><th>Title</th><th>Author(s)</th><th>Category</th><th>Copies</th><th></th></tr></thead>
              <tbody>
                {books.map((b) => (
                  <tr key={b.id}>
                    <td>{b.title}</td>
                    <td>{b.authors}</td>
                    <td>{b.category_detail?.name || "—"}</td>
                    <td>{b.available_copies} / {b.total_copies}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="lib-btn lib-btn-outline lib-btn-sm" onClick={() => setBookModal(b)}>Edit</button>
                      <button className="lib-btn lib-btn-danger lib-btn-sm" onClick={() => deleteBook(b.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!books.length && <div className="lib-empty">No books found.</div>}
          </div>
        </div>
      )}

      {subTab === "copies" && (
        <div className="lib-card">
          <div className="lib-toolbar">
            <form className="lib-toolbar-left" onSubmit={runSearch}>
              <input className="lib-input" placeholder="Search accession no. / title" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="lib-btn lib-btn-outline" type="submit">Search</button>
            </form>
            <button className="lib-btn lib-btn-primary" onClick={() => setCopyModal({})}>
              <i className="bi bi-plus-lg" /> Add copy
            </button>
          </div>
          <div className="lib-table-wrap">
            <table className="lib-table">
              <thead><tr><th>Accession #</th><th>Title</th><th>Shelf</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {copies.map((c) => (
                  <tr key={c.id}>
                    <td>{c.accession_number}</td>
                    <td>{books.find((b) => b.id === c.book)?.title || c.book}</td>
                    <td>{c.shelf_location || "—"}</td>
                    <td><span className="lib-badge lib-badge-blue">{c.status}</span></td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="lib-btn lib-btn-outline lib-btn-sm" onClick={() => setCopyModal(c)}>Edit</button>
                      <button className="lib-btn lib-btn-danger lib-btn-sm" onClick={() => deleteCopy(c.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!copies.length && <div className="lib-empty">No copies found.</div>}
          </div>
        </div>
      )}

      {subTab === "categories" && (
        <div className="lib-card">
          <div className="lib-toolbar">
            <div />
            <button className="lib-btn lib-btn-primary" onClick={() => setCatModal({})}>
              <i className="bi bi-plus-lg" /> Add category
            </button>
          </div>
          <div className="lib-table-wrap">
            <table className="lib-table">
              <thead><tr><th>Name</th><th>Description</th><th></th></tr></thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.description || "—"}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="lib-btn lib-btn-outline lib-btn-sm" onClick={() => setCatModal(c)}>Edit</button>
                      <button className="lib-btn lib-btn-danger lib-btn-sm" onClick={() => deleteCategory(c.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!categories.length && <div className="lib-empty">No categories yet.</div>}
          </div>
        </div>
      )}

      {bookModal && (
        <BookModal
          initial={bookModal}
          categories={categories}
          onClose={() => setBookModal(null)}
          onSave={saveBook}
        />
      )}
      {copyModal && (
        <CopyModal
          initial={copyModal}
          books={books}
          onClose={() => setCopyModal(null)}
          onSave={saveCopy}
        />
      )}
      {catModal && (
        <CategoryModal initial={catModal} onClose={() => setCatModal(null)} onSave={saveCategory} />
      )}
    </div>
  );
}

function BookModal({ initial, categories, onClose, onSave }) {
  const [form, setForm] = useState({
    title: initial.title || "",
    authors: initial.authors || "",
    isbn: initial.isbn || "",
    publisher: initial.publisher || "",
    edition: initial.edition || "",
    publication_year: initial.publication_year || "",
    category: initial.category || "",
    description: initial.description || "",
    id: initial.id,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal title={initial.id ? "Edit book" : "Add book"} onClose={onClose}>
      <div className="lib-field"><label>Title</label><input className="lib-input" value={form.title} onChange={set("title")} /></div>
      <div className="lib-field"><label>Author(s)</label><input className="lib-input" value={form.authors} onChange={set("authors")} placeholder="Comma-separated" /></div>
      <div className="lib-field"><label>ISBN</label><input className="lib-input" value={form.isbn} onChange={set("isbn")} /></div>
      <div className="lib-field"><label>Publisher</label><input className="lib-input" value={form.publisher} onChange={set("publisher")} /></div>
      <div className="lib-field"><label>Edition</label><input className="lib-input" value={form.edition} onChange={set("edition")} /></div>
      <div className="lib-field"><label>Publication year</label><input type="number" className="lib-input" value={form.publication_year} onChange={set("publication_year")} /></div>
      <div className="lib-field">
        <label>Category</label>
        <select className="lib-select" value={form.category} onChange={set("category")}>
          <option value="">— None —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="lib-field"><label>Description</label><textarea className="lib-textarea" value={form.description} onChange={set("description")} /></div>
      <div className="lib-modal-actions">
        <button className="lib-btn lib-btn-outline" onClick={onClose}>Cancel</button>
        <button className="lib-btn lib-btn-primary" onClick={() => onSave(form)}>Save</button>
      </div>
    </Modal>
  );
}

function CopyModal({ initial, books, onClose, onSave }) {
  const [form, setForm] = useState({
    book: initial.book || "",
    accession_number: initial.accession_number || "",
    shelf_location: initial.shelf_location || "",
    status: initial.status || "available",
    condition_notes: initial.condition_notes || "",
    id: initial.id,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal title={initial.id ? "Edit copy" : "Add copy"} onClose={onClose}>
      <div className="lib-field">
        <label>Book</label>
        <select className="lib-select" value={form.book} onChange={set("book")}>
          <option value="">Select a title…</option>
          {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
      </div>
      <div className="lib-field"><label>Accession number</label><input className="lib-input" value={form.accession_number} onChange={set("accession_number")} /></div>
      <div className="lib-field"><label>Shelf location</label><input className="lib-input" value={form.shelf_location} onChange={set("shelf_location")} /></div>
      <div className="lib-field">
        <label>Status</label>
        <select className="lib-select" value={form.status} onChange={set("status")}>
          {COPY_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
      </div>
      <div className="lib-field"><label>Condition notes</label><textarea className="lib-textarea" value={form.condition_notes} onChange={set("condition_notes")} /></div>
      <div className="lib-modal-actions">
        <button className="lib-btn lib-btn-outline" onClick={onClose}>Cancel</button>
        <button className="lib-btn lib-btn-primary" onClick={() => onSave(form)}>Save</button>
      </div>
    </Modal>
  );
}

function CategoryModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    name: initial.name || "",
    description: initial.description || "",
    id: initial.id,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal title={initial.id ? "Edit category" : "Add category"} onClose={onClose}>
      <div className="lib-field"><label>Name</label><input className="lib-input" value={form.name} onChange={set("name")} /></div>
      <div className="lib-field"><label>Description</label><textarea className="lib-textarea" value={form.description} onChange={set("description")} /></div>
      <div className="lib-modal-actions">
        <button className="lib-btn lib-btn-outline" onClick={onClose}>Cancel</button>
        <button className="lib-btn lib-btn-primary" onClick={() => onSave(form)}>Save</button>
      </div>
    </Modal>
  );
}
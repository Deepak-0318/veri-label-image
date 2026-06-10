using DocumentModel = verilabelbackend.Models.Document;

namespace verilabelbackend.Repositories;

public sealed class DocumentRepository : IDocumentRepository
{
    private readonly List<DocumentModel> _store = [];
    private readonly Lock _lock = new();

    public Task<DocumentModel> CreateAsync(DocumentModel doc)
    {
        lock (_lock) _store.Add(doc);
        return Task.FromResult(doc);
    }
    public Task<DocumentModel?> GetByIdAsync(Guid id)
    {
        lock (_lock) return Task.FromResult(_store.FirstOrDefault(d => d.Id == id));
    }
    public Task<IReadOnlyList<DocumentModel>> GetByUserIdAsync(Guid userId)
    {
        lock (_lock) return Task.FromResult<IReadOnlyList<DocumentModel>>(
            _store.Where(d => d.UserId == userId).ToList());
    }
    public Task<IReadOnlyList<DocumentModel>> GetAllAsync()
    {
        lock (_lock) return Task.FromResult<IReadOnlyList<DocumentModel>>(
            _store.ToList());
    }
    public Task DeleteAsync(Guid id)
    {
        lock (_lock) _store.RemoveAll(d => d.Id == id);
        return Task.CompletedTask;
    }
}
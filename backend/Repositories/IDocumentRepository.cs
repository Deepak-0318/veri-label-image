using DocumentModel = verilabelbackend.Models.Document;

namespace verilabelbackend.Repositories;  

public interface IDocumentRepository
{
    Task<DocumentModel> CreateAsync(DocumentModel doc);
    Task<DocumentModel?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<DocumentModel>> GetByUserIdAsync(Guid userId);
    Task<IReadOnlyList<DocumentModel>> GetAllAsync();
    Task DeleteAsync(Guid id);
}
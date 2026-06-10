namespace verilabelbackend.Models;

public sealed class Document
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid UserId { get; init; }
    public string OriginalName { get; init; } = string.Empty;
    public string BlobPath { get; init; } = string.Empty;
    public string ContentType { get; init; } = string.Empty;
    public long SizeBytes { get; init; }
    public DateTimeOffset UploadedAt { get; init; } = DateTimeOffset.UtcNow;
}
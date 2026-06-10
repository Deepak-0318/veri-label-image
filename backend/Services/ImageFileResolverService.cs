using verilabelbackend.Models.Supabase;
using verilabelbackend.Services.Azure;
using verilabelbackend.Services.Supabase;

namespace verilabelbackend.Services;

public class ImageFileResolverService
{
    private readonly SupabaseFileService _fileService;
    private readonly AzureBlobStorageService _storage;
    private readonly IHttpClientFactory _httpClientFactory;

    public ImageFileResolverService(
        SupabaseFileService fileService,
        AzureBlobStorageService storage,
        IHttpClientFactory httpClientFactory)
    {
        _fileService = fileService;
        _storage = storage;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<Stream> GetImageStreamAsync(
        string jwt,
        Guid fileId)
    {
        var file = await _fileService.GetFileByIdAsync(jwt, fileId);

        if (file == null)
            throw new Exception($"File not found: {fileId}");

        if (string.IsNullOrWhiteSpace(file.ThumbnailUrl))
            throw new Exception($"Blob path missing for file: {fileId}");

        Console.WriteLine($"[ImageResolver] BlobPath = {file.ThumbnailUrl}");

        var sasUrl = _storage.GenerateSasUrl(file.ThumbnailUrl);

        Console.WriteLine($"[ImageResolver] SAS URL generated");

        var client = _httpClientFactory.CreateClient();

        var stream = await client.GetStreamAsync(sasUrl);

        Console.WriteLine($"[ImageResolver] Image downloaded");

        return stream;
    }
}
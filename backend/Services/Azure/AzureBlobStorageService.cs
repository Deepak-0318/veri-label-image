using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using Azure.Storage;

namespace verilabelbackend.Services.Azure;

public sealed class AzureBlobStorageService
{
    private readonly BlobContainerClient _container;
    private readonly StorageSharedKeyCredential _credential;
    public readonly string containerName;

    private static readonly Dictionary<string, string> MimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".webp"] = "image/webp",
        [".txt"] = "text/plain",
        [".md"] = "text/markdown",
        [".wav"] = "audio/wav",
        [".mp3"] = "audio/mpeg",
        [".flac"] = "audio/flac",
        [".m4a"] = "audio/mp4",
        [".mp4"] = "video/mp4",
        [".webm"] = "video/webm",
        [".mov"] = "video/quicktime",
        [".pdf"] = "application/pdf",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".csv"] = "text/csv",
        [".mcap"] = "application/octet-stream",
        [".pcd"] = "application/pcd",
        [".npz"] = "application/npz"
    };

    public AzureBlobStorageService(IConfiguration config)
    {
        var connectionString = config["AzureStorage:ConnectionString"]
            ?? throw new InvalidOperationException("AzureStorage:ConnectionString is missing.");

        containerName = config["AzureStorage:ContainerName"]
            ?? throw new InvalidOperationException("AzureStorage:ContainerName is missing.");

        var serviceClient = new BlobServiceClient(connectionString);
        _container = serviceClient.GetBlobContainerClient(containerName);

        var parts = connectionString.Split(';');

        var accountName = connectionString
                    .Split(';')
                    .First(x => x.StartsWith("AccountName="))
                    .Replace("AccountName=", "");

        var accountKey = connectionString
            .Split(';')
            .First(x => x.StartsWith("AccountKey="))
            .Replace("AccountKey=", "");

        _credential = new StorageSharedKeyCredential(accountName, accountKey);

    }

    public static bool IsSupportedExtension(string ext) => MimeTypes.ContainsKey(ext);
    public static IEnumerable<string> SupportedExtensions() => MimeTypes.Keys;
    public static string ResolveMime(string ext) =>
        MimeTypes.TryGetValue(ext, out var mime) ? mime : "application/octet-stream";

    public async Task<(string blobPath, string blobUrl)> SaveAsync(Stream stream, string fileName, Guid userId)
    {
        var safe = $"{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{Sanitize(fileName)}";
        var blobPath = $"{userId}/{safe}";
        var ext = Path.GetExtension(fileName);

        // Pass the raw (unencoded) blob path; the SDK handles URL-encoding internally.
        var client = _container.GetBlobClient(blobPath);
        await client.UploadAsync(stream, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = ResolveMime(ext) },
            Metadata = new Dictionary<string, string>
            {
                ["userId"] = userId.ToString(),
                ["originalName"] = fileName
            }
        });
        // Return the raw blob path (not the encoded URL) so downstream
        // SAS generation does not re-encode an already-encoded string.
        return (blobPath, blobPath);
    }
    public string ExtractBlobPath(string fullUrl)
    {
        if (string.IsNullOrEmpty(fullUrl)) return "";

        var uri = new Uri(fullUrl);

        return uri.AbsolutePath.Replace($"/{containerName}/", "");
    }

    public string GenerateSasUrl(string blobPathOrUrl, int expiryHours = 3)
    {
        if (string.IsNullOrWhiteSpace(blobPathOrUrl))
            throw new ArgumentException("Invalid blob path");

        string blobPath = blobPathOrUrl;

        if (blobPathOrUrl.StartsWith("http"))
        {
            var uri = new Uri(blobPathOrUrl);
            // AbsolutePath returns a percent-encoded string; decode once so
            // GetBlobClient does not re-encode characters like '(' -> %2528.
            blobPath = Uri.UnescapeDataString(
                uri.AbsolutePath.TrimStart('/').Replace($"{_container.Name}/", ""));
        }

        var blobClient = _container.GetBlobClient(blobPath);

        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = _container.Name,
            BlobName = blobPath,
            Resource = "b",
            StartsOn = DateTimeOffset.UtcNow.AddMinutes(-5),
            ExpiresOn = DateTimeOffset.UtcNow.AddHours(expiryHours)
        };

        sasBuilder.SetPermissions(BlobSasPermissions.Read);

        var sasToken = sasBuilder
            .ToSasQueryParameters(_credential)
            .ToString();

        return $"{blobClient.Uri}?{sasToken}";
    }

    public async Task DeleteAsync(string blobPath)
    {
        await _container.GetBlobClient(blobPath).DeleteIfExistsAsync();
    }

    public async Task<bool> ExistsAsync(string blobPath)
    {
        return await _container.GetBlobClient(blobPath).ExistsAsync();
    }

    private static string Sanitize(string name)
    {
        var stem = Path.GetFileNameWithoutExtension(name);
        var ext = Path.GetExtension(name).ToLowerInvariant();
        // Replace spaces and characters that would otherwise force URL
        // encoding (e.g. parentheses) so blob paths stay round-trip safe.
        var cleanedStem = System.Text.RegularExpressions.Regex.Replace(
            stem, @"[^A-Za-z0-9._-]", "_");
        return cleanedStem + ext;
    }


}
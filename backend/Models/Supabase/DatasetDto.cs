using Microsoft.AspNetCore.Mvc;

namespace verilabelbackend.Models.Supabase
{
    public class CreateDatasetRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public Guid? ProjectId { get; set; }
    }

    public class AssignProjectRequest
    {
        public Guid? ProjectId { get; set; }
    }

    public class AddFilesRequest
    {
        public List<Guid> FileIds { get; set; } = new();
    }

    public class FileDatasetMapRequest
    {
        public List<Guid> DatasetIds { get; set; } = new();
    }


    public class DatasetFileIdOnly
    {
        public Guid FileId { get; set; }
    }

    public class DatasetIdsRequest
    {
        public List<Guid> DatasetIds { get; set; } = new();
    }


}

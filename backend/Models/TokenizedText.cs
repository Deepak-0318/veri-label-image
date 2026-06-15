using System;

namespace verilabelbackend.Models;

public class TokenizedText
{
    public int[] InputIds { get; set; } = Array.Empty<int>();
    public int[] AttentionMask { get; set; } = Array.Empty<int>();
    public int[] TokenTypeIds { get; set; } = Array.Empty<int>();
}

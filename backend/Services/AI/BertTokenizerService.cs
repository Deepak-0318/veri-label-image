using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Hosting;
using Microsoft.ML.Tokenizers;
using verilabelbackend.Models;

namespace verilabelbackend.Services.AI;

public class BertTokenizerService
{
    private readonly BertTokenizer _tokenizer;

    public BertTokenizerService(IWebHostEnvironment env)
    {
        var vocabPath = Path.Combine(
            env.ContentRootPath,
            "Models",
            "ONNX",
            "vocab.txt"
        );

        if (!File.Exists(vocabPath))
        {
            throw new FileNotFoundException($"Vocabulary file not found at: {vocabPath}");
        }

        Console.WriteLine($"[Tokenizer] Loading vocabulary from {vocabPath}");
        _tokenizer = BertTokenizer.Create(vocabPath);
        Console.WriteLine("[Tokenizer] Vocabulary loaded successfully");
    }

    public TokenizedText Tokenize(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return new TokenizedText
            {
                InputIds = new int[] { 101, 102 },
                AttentionMask = new int[] { 1, 1 },
                TokenTypeIds = new int[] { 0, 0 }
            };
        }

        // Lowercase text as required by bert-base-uncased
        string cleanedText = text.ToLowerInvariant().Trim();

        // Encode to IDs
        IReadOnlyList<int> rawIds = _tokenizer.EncodeToIds(cleanedText);

        // GroundingDINO/BERT expectations: [CLS] at the start, [SEP] at the end
        // [CLS] = 101, [SEP] = 102
        var inputIdsList = new List<int> { 101 };
        inputIdsList.AddRange(rawIds);
        inputIdsList.Add(102);

        int[] inputIds = inputIdsList.ToArray();
        int[] attentionMask = Enumerable.Repeat(1, inputIds.Length).ToArray();
        int[] tokenTypeIds = Enumerable.Repeat(0, inputIds.Length).ToArray();

        Console.WriteLine("InputIds:");
        Console.WriteLine(string.Join(",", inputIds.Take(20)));
        Console.WriteLine("AttentionMask:");
        Console.WriteLine(string.Join(",", attentionMask.Take(20)));
        Console.WriteLine("TokenTypeIds:");
        Console.WriteLine(string.Join(",", tokenTypeIds.Take(20)));

        return new TokenizedText
        {
            InputIds = inputIds,
            AttentionMask = attentionMask,
            TokenTypeIds = tokenTypeIds
        };
    }
}

using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Xunit;
using verilabelbackend.Controllers;
using verilabelbackend.Services.Supabase;

namespace verilabelbackend.Tests
{
    public sealed class AnnotationsControllerTests
    {
        private readonly AnnotationsController _controller;
        private readonly IConfiguration _configuration;

        public AnnotationsControllerTests()
        {
            // Setup dummy configuration
            var configData = new Dictionary<string, string?>
            {
                { "Supabase:Url", "https://mock.supabase.co" },
                { "Supabase:AnonKey", "mock-anon-key" }
            };
            _configuration = new ConfigurationBuilder().AddInMemoryCollection(configData).Build();

            // Setup mock HttpClientFactory
            var mockFactory = new MockHttpClientFactory();

            // Instantiate actual service with dummy dependencies
            var annotationService = new SupabaseAnnotationService(mockFactory, _configuration);

            _controller = new AnnotationsController(annotationService, mockFactory, _configuration);

            // Setup User Claims Principal representing an Authenticated user
            var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim("sub", Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Role, "annotator")
            }, "mock-auth"));

            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };
        }

        [Fact]
        public async Task Create_BoundingBox_NegativeDimensions_ReturnsBadRequest()
        {
            // Arrange
            var payload = new Dictionary<string, object>
            {
                { "type", "boundingBox" },
                { "label", "Car" },
                { "color", "#ff0000" },
                { "data", JsonSerializer.Serialize(new { x = 10, y = 20, width = -5, height = 30 }) }
            };

            // Act
            var result = await _controller.Create(payload);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Contains("width and height must be non-negative", badRequest.Value?.ToString());
        }

        [Fact]
        public async Task Create_Polygon_TooFewPoints_ReturnsBadRequest()
        {
            // Arrange
            var payload = new Dictionary<string, object>
            {
                { "type", "polygon" },
                { "label", "Building" },
                { "color", "#00ff00" },
                { "data", JsonSerializer.Serialize(new
                    {
                        points = new[]
                        {
                            new { x = 0, y = 0 },
                            new { x = 10, y = 0 }
                        }
                    })
                }
            };

            // Act
            var result = await _controller.Create(payload);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Contains("polygon annotations must contain at least 3 points", badRequest.Value?.ToString(), StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task Create_Polyline_TooFewPoints_ReturnsBadRequest()
        {
            // Arrange
            var payload = new Dictionary<string, object>
            {
                { "type", "polyline" },
                { "label", "Lane" },
                { "color", "#0000ff" },
                { "data", JsonSerializer.Serialize(new
                    {
                        points = new[]
                        {
                            new { x = 0, y = 0 }
                        }
                    })
                }
            };

            // Act
            var result = await _controller.Create(payload);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Contains("polyline annotations must contain at least 2 points", badRequest.Value?.ToString(), StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task Create_Point_MissingCoordinates_ReturnsBadRequest()
        {
            // Arrange
            var payload = new Dictionary<string, object>
            {
                { "type", "point" },
                { "label", "Keypoint" },
                { "color", "#ffff00" },
                { "data", JsonSerializer.Serialize(new { x = 10 }) } // Missing y coordinate
            };

            // Act
            var result = await _controller.Create(payload);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Contains("must contain x and y coordinates", badRequest.Value?.ToString(), StringComparison.OrdinalIgnoreCase);
        }
    }

    // A dummy HttpClientFactory implementation for tests
    internal class MockHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name)
        {
            return new HttpClient(new MockHttpMessageHandler());
        }
    }

    internal class MockHttpMessageHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, System.Threading.CancellationToken cancellationToken)
        {
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent("[]")
            });
        }
    }
}

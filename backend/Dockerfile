FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /app

# Copy csproj files and restore dependencies
COPY ["src/AiRiser.Api/AiRiser.Api.csproj", "src/AiRiser.Api/"]
COPY ["src/AiRiser.Core/AiRiser.Core.csproj", "src/AiRiser.Core/"]
COPY ["src/AiRiser.Infrastructure/AiRiser.Infrastructure.csproj", "src/AiRiser.Infrastructure/"]

RUN dotnet restore "src/AiRiser.Api/AiRiser.Api.csproj"

# Copy all files and publish Release build
COPY . .
WORKDIR "/app/src/AiRiser.Api"
RUN dotnet publish "AiRiser.Api.csproj" -c Release -o /app/out /p:UseAppHost=false

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS runtime
WORKDIR /app
COPY --from=build /app/out .

ENV DOTNET_USE_POLLING_FILE_WATCHER=true
ENV DOTNET_EnableDiagnostics=0
ENV ASPNETCORE_URLS=http://+:8080
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "AiRiser.Api.dll"]

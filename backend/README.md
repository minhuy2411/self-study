# AiRiser Backend (.NET 8 Web API)

Hướng dẫn cài đặt, cấu hình Database PostgreSQL, thực hiện EF Core Migration và chạy dự án Backend **AiRiser**.

---

## 1. Cấu trúc Dự án (Clean Architecture)

- **`src/AiRiser.Core/`**: Chứa Domain Entities (`User`, `Vocabulary`, `WordMemory`), DTOs, và các Interfaces.
- **`src/AiRiser.Infrastructure/`**: Chứa `AppDbContext`, EF Core Configurations, Services (`AuthService`, `VocabularyService`, `ExternalDictionaryService`).
- **`src/AiRiser.Api/`**: ASP.NET Core Web API Controllers, `Program.cs`, và `appsettings.json`.

---

## 2. Yêu cầu Tiền đề (Prerequisites)

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) trở lên
- [PostgreSQL](https://www.postgresql.org/download/) (mặc định port 5432)
- Công cụ **EF Core CLI tool** (cài đặt nếu chưa có):
  ```powershell
  dotnet tool install --global dotnet-ef
  ```

---

## 3. Cấu hình Chuỗi Kết nối Database (Connection String)

Mở file `src/AiRiser.Api/appsettings.json` và cập nhật thông tin PostgreSQL:

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Database=AiRiserDb;Username=postgres;Password=123456"
}
```

---

## 4. Các Câu lệnh EF Core Migration & Database Setup

> **Lưu ý**: Thực thi câu lệnh tại thư mục `backend` (`E:\huynguyen\ai-riser\backend`).

### A. Tạo Migration mới (Add Migration)

Tạo bản snapshot DB đầu tiên cho các bảng `Users`, `Vocabularies`, `WordMemories`:

```powershell
dotnet ef migrations add InitialCreate --project src/AiRiser.Infrastructure --startup-project src/AiRiser.Api
```

### B. Cập nhật Migration vào Database (Update Database)

Áp dụng các file Migration vào PostgreSQL Database thực tế:

```powershell
dotnet ef database update --project src/AiRiser.Infrastructure --startup-project src/AiRiser.Api
```

### C. Xóa Migration cũ / Rollback (nếu cần)

- Hủy migration vừa tạo (chưa update DB):
  ```powershell
  dotnet ef migrations remove --project src/AiRiser.Infrastructure --startup-project src/AiRiser.Api
  ```
- Rollback database về một migration cụ thể:
  ```powershell
  dotnet ef database update <MigrationName> --project src/AiRiser.Infrastructure --startup-project src/AiRiser.Api
  ```

---

## 5. Hướng dẫn Chạy Backend Project

### Chạy trực tiếp bằng .NET CLI

```powershell
# Chạy từ thư mục backend
dotnet run --project src/AiRiser.Api
```

Default URL của backend API: `http://localhost:5000` hoặc `https://localhost:5001`.

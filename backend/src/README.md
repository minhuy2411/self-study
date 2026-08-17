# AiRiser Backend (.NET 8 Web API)

Hướng dẫn cài đặt, cấu hình Database PostgreSQL, thực hiện EF Core Migration và chạy dự án Backend **AiRiser**.

---

## 1. Cấu trúc Dự án (Clean Architecture)

- **`AiRiser.Core/`**: Chứa Domain Entities (`User`, `Vocabulary`, `WordMemory`), DTOs, và các Interfaces.
- **`AiRiser.Infrastructure/`**: Chứa `AppDbContext`, EF Core Configurations, Services (`AuthService`, `VocabularyService`, `ExternalDictionaryService`).
- **`AiRiser.Api/`**: ASP.NET Core Web API Controllers, `Program.cs`, và `appsettings.json`.

---

## 2. Yêu cầu Tiền đề (Prerequisites)

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) trở lên
- [PostgreSQL](https://www.postgresql.org/download/) (mặc định port 5432) hoặc sử dụng SQLite/InMemory
- Công cụ **EF Core CLI tool**:
  ```powershell
  dotnet tool install --global dotnet-ef
  ```

---

## 3. Cấu hình Chuỗi Kết nối Database (Connection String)

Mở file `backend/src/AiRiser.Api/appsettings.json` và cập nhật thông tin PostgreSQL:

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Database=AiRiserDb;Username=postgres;Password=YOUR_PASSWORD"
}
```

---

## 4. Các Câu lệnh EF Core Migration & Database Setup

> **Lưu ý**: Đảm bảo bạn đang đứng ở thư mục `backend` (hoặc `E:\huynguyen\ai-riser\backend`).

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
- Hủy migration chưa apply:
  ```powershell
  dotnet ef migrations remove --project src/AiRiser.Infrastructure --startup-project src/AiRiser.Api
  ```
- Rollback database về một migration cụ thể:
  ```powershell
  dotnet ef database update <MigrationName> --project src/AiRiser.Infrastructure --startup-project src/AiRiser.Api
  ```

---

## 5. Hướng dẫn Chạy Backend Project

### Cách 1: Chạy trực tiếp qua .NET CLI
```powershell
# Chạy từ thư mục backend
dotnet run --project src/AiRiser.Api
```

### Cách 2: Chạy solution với Visual Studio / VS Code
- Mở file `backend/AiRiser.slnx` trong Visual Studio.
- Đặt `AiRiser.Api` làm **Startup Project**.
- Bấm `F5` hoặc `Ctrl + F5` để chạy.

Default URL của backend API: `http://localhost:5000` hoặc `https://localhost:5001`.

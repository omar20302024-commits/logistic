# مخطط العلاقات (ERD)

```mermaid
erDiagram
    PROFILES ||--o{ TRIPS : "created_by (اختياري لاحقاً)"
    DRIVERS ||--o{ TRIPS : "ينفذ"
    COMPANIES ||--o{ TRIPS : "تطلب"
    TRIPS ||--o{ TRIP_LOCATIONS : "تحتوي"
    DRIVERS ||--o{ SALARIES : "له"
    DRIVERS ||--o{ DRIVER_ADVANCES : "له"
    DRIVERS ||--o{ DRIVER_DEDUCTIONS : "له"

    DRIVERS {
        uuid id PK
        text name
        text phone
        numeric salary
        date hire_date
        driver_status status
        text notes
    }

    COMPANIES {
        uuid id PK
        text name
        text phone
        text address
        text contact_person
        company_status status
        text notes
    }

    TRIPS {
        uuid id PK
        text trip_number
        uuid driver_id FK
        uuid company_id FK
        date trip_date
        text from_location
        text to_location
        numeric trip_amount "سري - سعر العميل"
        numeric driver_trip_payment "التربة"
        numeric diesel_amount
        numeric trip_profit "GENERATED: amount - payment - diesel"
        trip_status status
        text notes
    }

    TRIP_LOCATIONS {
        uuid id PK
        uuid trip_id FK
        location_type location_type "loading/unloading"
        text location_name
        numeric amount
        amount_status amount_status "temporary/confirmed"
        text notes
    }

    SALARIES {
        uuid id PK
        uuid driver_id FK
        int month
        int year
        numeric basic_salary
        numeric paid_amount
        date payment_date
        text notes
    }

    DRIVER_ADVANCES {
        uuid id PK
        uuid driver_id FK
        date date
        numeric amount
        text description
        text notes
    }

    DRIVER_DEDUCTIONS {
        uuid id PK
        uuid driver_id FK
        date date
        numeric amount
        text description
        text notes
    }

    EXPENSES {
        uuid id PK
        date date
        text category
        text description
        numeric amount
        text notes
    }

    PROFILES {
        uuid id PK
        text full_name
        user_role role
        text phone
    }
```

## ملاحظات على العلاقات

- `TRIPS → TRIP_LOCATIONS`: **1 إلى عدد غير محدود**، `ON DELETE CASCADE` (حذف الرحلة يحذف مواقعها).
- `DRIVERS → TRIPS`: `ON DELETE RESTRICT` — **لا يمكن حذف سائق له رحلات** (لحماية السجل
  المالي التاريخي). البديل هو تغيير حالته إلى "غير نشط".
- `COMPANIES → TRIPS`: نفس منطق `RESTRICT` لنفس السبب.
- `DRIVERS → SALARIES / ADVANCES / DEDUCTIONS`: `ON DELETE CASCADE` (هذه سجلات تابعة
  بالكامل للسائق، لا معنى لبقائها بدونه) — لكن عملياً سنمنع حذف السائق أصلاً إن كانت
  له بيانات مالية (نفس منطق الرحلات)، والـ CASCADE هنا هو شبكة أمان إضافية فقط.
- `EXPENSES`: جدول مستقل (مصروفات إدارية عامة)، غير مرتبط بسائق أو رحلة.

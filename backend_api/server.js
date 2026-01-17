const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3000;

// Kết nối Database
const pool = new Pool({
  user: 'locnguyen',        
  host: 'localhost',
  database: 'webgis_db',
  password: '',
  port: 5432,
});

app.use(cors());
app.use(express.json());

// 1. API LẤY CĂN HỘ (Cho Map 3D)
app.get('/api/apartments', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM apartments");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi Server");
    }
});

// 2. API ĐĂNG NHẬP (Đã bổ sung trả về res_id)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const query = `
            SELECT a.account_id, a.username, a.role, r.full_name, r.res_id, apt.apt_code 
            FROM accounts a
            LEFT JOIN residents r ON a.res_id = r.res_id
            LEFT JOIN contracts c ON r.res_id = c.res_id AND c.status = 'Active'
            LEFT JOIN apartments apt ON c.apt_id = apt.apt_id
            WHERE a.username = $1 AND a.password = $2
        `;
        const result = await pool.query(query, [username, password]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.json({ 
                success: true, 
                role: user.role, 
                name: user.full_name || 'Quản Trị Viên',
                code: user.apt_code || 'Chưa thuê',
                res_id: user.res_id // Quan trọng để lấy hóa đơn
            });
        } else {
            res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });
        }
    } catch (err) { res.status(500).json({ success: false, message: "Lỗi Server Login" }); }
});
// ==========================================
// API KHÁCH THAM QUAN
// ==========================================
// 1. API TÌM KIẾM CĂN HỘ (Cho Map 3D)
app.get('/api/apartments/search', async (req, res) => {
    try {
        const { block, floor, type, status } = req.query; 
        
        // SELECT price as rent_price để khớp với frontend đang dùng biến rent_price
        let query = "SELECT *, price as rent_price FROM apartments WHERE 1=1"; 
        let params = [];
        let pIndex = 1;

        // 1. Lọc theo Block (Dùng cột block_name nếu có, hoặc apt_code)
        if (block && block !== 'All') {
            query += ` AND block_name = $${pIndex}`;
            params.push(block);
            pIndex++;
        }

        // 2. Lọc theo Tầng (Cột 'floor')
        if (floor && floor !== 'All') {
            query += ` AND floor = $${pIndex}`;
            params.push(floor);
            pIndex++;
        }

        // 3. Lọc theo Loại căn hộ (Số phòng ngủ - beds)
        if (type && type !== 'All') {
            query += ` AND beds = $${pIndex}`; 
            params.push(type);
            pIndex++;
        }

        // 4. Lọc theo Trạng thái
        if (status && status !== 'All') {
            query += ` AND status = $${pIndex}`;
            params.push(status);
            pIndex++;
        }

        query += " ORDER BY apt_code ASC";

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (err) {
        console.error("Lỗi Search:", err);
        // In tên database đang kết nối để debug nếu vẫn lỗi
        console.log("Đang kết nối tới DB:", process.env.DB_DATABASE || 'chưa set env');
        res.status(500).json({ error: "Lỗi Server: " + err.message }); 
    }
});

// 2. API Gửi yêu cầu tư vấn (Visitor)
app.post('/api/consultations', async (req, res) => {
    const { name, phone, email, apt_id, note } = req.body;
    try {
        await pool.query(
            "INSERT INTO consultations (customer_name, phone, email, apt_id, note) VALUES ($1, $2, $3, $4, $5)",
            [name, phone, email, apt_id, note]
        );
        res.json({ success: true, message: "Đã gửi thông tin! Admin sẽ liên hệ sớm." });
    } catch (err) { res.status(500).json({ success: false }); }
});
// ==========================================
// API CƯ DÂN 
// ==========================================
// 3. API LẤY HÓA ĐƠN CƯ DÂN
app.get('/api/resident/invoices/:res_id', async (req, res) => {
    try {
        const query = `
            SELECT i.invoice_id, i.month, i.total_amount, i.is_paid
            FROM invoices i
            JOIN contracts c ON i.contract_id = c.contract_id
            WHERE c.res_id = $1
        `;
        const result = await pool.query(query, [req.params.res_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Lỗi Server'); }
});

// 4. API GỬI YÊU CẦU / BÁO SỰ CỐ
app.post('/api/resident/requests', async (req, res) => {
    const { res_id, apt_code, content } = req.body;
    try {
        // Lấy apt_id từ apt_code
        const aptRes = await pool.query("SELECT apt_id FROM apartments WHERE apt_code = $1", [apt_code]);
        if(aptRes.rows.length === 0) return res.json({success: false, message: "Căn hộ không tồn tại"});
        
        const apt_id = aptRes.rows[0].apt_id;

        await pool.query(
            "INSERT INTO requests (apt_id, content, status) VALUES ($1, $2, 'New')",
            [apt_id, content]
        );
        res.json({ success: true, message: "Đã gửi yêu cầu thành công!" });
    } catch (err) { 
        console.log(err);
        res.status(500).json({ success: false, message: "Lỗi Server Request" }); 
    }
});

// 5. API UPDATE (Admin)
app.post('/api/apartments/update', async (req, res) => {
    const { code, price, status } = req.body;
    try {
        await pool.query('UPDATE apartments SET price = $1, status = $2 WHERE apt_code = $3', [price, status, code]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// 6. Lấy Xe cộ của Cư dân
app.get('/api/resident/vehicles/:res_id', async (req, res) => {
    try {
        const query = `
            SELECT v.vehicle_id, v.license_plate, v.type, v.status, 
                   s.slot_code, z.zone_name
            FROM vehicles v
            JOIN apartments apt ON v.apt_id = apt.apt_id
            JOIN contracts c ON c.apt_id = apt.apt_id
            LEFT JOIN parking_slots s ON v.slot_id = s.slot_id
            LEFT JOIN parking_zones z ON s.zone_id = z.zone_id
            WHERE c.res_id = $1 AND c.status = 'Active'
        `;
        const result = await pool.query(query, [req.params.res_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Lỗi Server'); }
});

// 7. Lấy Chi tiết hóa đơn 
app.get('/api/resident/invoice-details/:invoice_id', async (req, res) => {
    try {
        const query = `
            SELECT s.name, d.usage_amount, d.sub_total
            FROM invoice_details d
            JOIN services s ON d.service_id = s.service_id
            WHERE d.invoice_id = $1
        `;
        const result = await pool.query(query, [req.params.invoice_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Lỗi Server'); }
});

// 8. Lấy Nội thất 
app.get('/api/apartments/furniture/:code', async (req, res) => {
    try {
        const query = `
            SELECT f.name, f.condition
            FROM furniture f
            JOIN apartments a ON f.apt_id = a.apt_id
            WHERE a.apt_code = $1
        `;
        const result = await pool.query(query, [req.params.code]);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Lỗi Server'); }
});

// 9. Lấy Lịch sử yêu cầu của cư dân
app.get('/api/resident/requests-history/:res_id', async (req, res) => {
    try {
        const query = `
            SELECT r.request_id, r.content, r.status
            FROM requests r
            JOIN contracts c ON r.apt_id = c.apt_id
            WHERE c.res_id = $1 AND c.status = 'Active'
            ORDER BY r.request_id DESC
        `;
        const result = await pool.query(query, [req.params.res_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Lỗi Server'); }
});

// 10. Đăng ký gửi xe (kiểm tra số lượng xe)
app.post('/api/resident/register-vehicle', async (req, res) => {
    const { res_id, license_plate, type } = req.body;
    try {
        // B1: Tìm apt_id
        const aptRes = await pool.query(
            "SELECT apt_id FROM contracts WHERE res_id = $1 AND status = 'Active'", 
            [res_id]
        );
        if(aptRes.rows.length === 0) return res.json({success: false, message: "Bạn chưa thuê căn hộ!"});
        const apt_id = aptRes.rows[0].apt_id;

        // B2: Đếm số lượng (FIX LỖI: Chỉ đếm xe Đang dùng, Chờ duyệt hoặc Chờ hủy)
        // Loại bỏ xe đã Hủy (Cancelled) hoặc Bị từ chối (Rejected)
        const countRes = await pool.query(
            `SELECT type, COUNT(*) as sl 
             FROM vehicles 
             WHERE apt_id = $1 
               AND status IN ('Active', 'Pending', 'Pending_Cancellation') 
             GROUP BY type`,
            [apt_id]
        );
        
        let counts = { 'Car': 0, 'Motorbike': 0 };
        countRes.rows.forEach(row => counts[row.type] = parseInt(row.sl));

        // B3: Kiểm tra quy định (Max 1 Car, 3 Motorbikes)
        if (type === 'Car' && counts['Car'] >= 1) {
            return res.json({ success: false, message: "❌ Đã hết suất đăng ký Ô tô (1 xe/căn)!" });
        }
        if (type === 'Motorbike' && counts['Motorbike'] >= 3) {
            return res.json({ success: false, message: "❌ Đã hết suất đăng ký Xe máy (3 xe/căn)!" });
        }

        // B4: Insert với trạng thái 'Pending'
        await pool.query(
            "INSERT INTO vehicles (license_plate, type, apt_id, status) VALUES ($1, $2, $3, 'Pending')",
            [license_plate, type, apt_id]
        );

        res.json({ success: true, message: "✅ Đã gửi yêu cầu! Vui lòng chờ Ban quản lý duyệt." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi Server" });
    }
});

// 11. API Hủy Yêu cầu / Sự cố
app.post('/api/resident/cancel-request', async (req, res) => {
    const { request_id } = req.body;
    try {
        // B1: Lấy thông tin yêu cầu trước khi hủy để xem nó có gắn với món đồ nào không
        const reqInfo = await pool.query("SELECT item_id FROM requests WHERE request_id = $1", [request_id]);
        
        if(reqInfo.rows.length > 0) {
            const itemId = reqInfo.rows[0].item_id;
            
            // B2: Nếu yêu cầu này liên quan đến nội thất -> Trả trạng thái về "Đang hoạt động"
            if (itemId) {
                await pool.query("UPDATE furniture SET condition = 'Đang hoạt động' WHERE item_id = $1", [itemId]);
            }
        }

        // B3: Hủy yêu cầu như bình thường
        await pool.query("UPDATE requests SET status = 'Cancelled' WHERE request_id = $1 AND status = 'New'", [request_id]);
        
        res.json({ success: true, message: "Đã hủy yêu cầu & Cập nhật lại trạng thái tài sản." });
    } catch (err) { res.status(500).json({ success: false }); }
});

// 12. API Hủy Đăng ký xe
app.post('/api/resident/cancel-vehicle', async (req, res) => {
    const { vehicle_id } = req.body;
    try {
        // Kiểm tra trạng thái hiện tại
        const check = await pool.query("SELECT status FROM vehicles WHERE vehicle_id = $1", [vehicle_id]);
        
        if (check.rows.length > 0) {
            const currentStatus = check.rows[0].status;

            if (currentStatus === 'Pending') {
                // Nếu đang chờ duyệt -> Hủy ngay (Cancelled)
                await pool.query("UPDATE vehicles SET status = 'Cancelled' WHERE vehicle_id = $1", [vehicle_id]);
                res.json({ success: true, message: "Đã hủy đăng ký xe ngay lập tức." });
            } 
            else if (currentStatus === 'Active') {
                // Nếu đang Active -> Chuyển sang Chờ hủy (Pending_Cancellation)
                await pool.query("UPDATE vehicles SET status = 'Pending_Cancellation' WHERE vehicle_id = $1", [vehicle_id]);
                res.json({ success: true, message: "Đã gửi yêu cầu hủy. Chờ Ban quản lý xác nhận." });
            } else {
                res.json({ success: false, message: "Không thể hủy ở trạng thái này." });
            }
        } else {
            res.json({ success: false, message: "Xe không tồn tại." });
        }
    } catch (err) { res.status(500).json({ success: false }); }
});

// 13. Lấy danh sách Nội thất của Cư dân
app.get('/api/resident/furniture/:res_id', async (req, res) => {
    try {
        const query = `
            SELECT f.item_id, f.name, f.condition 
            FROM furniture f
            JOIN apartments apt ON f.apt_id = apt.apt_id
            JOIN contracts c ON c.apt_id = apt.apt_id
            WHERE c.res_id = $1 AND c.status = 'Active'
        `;
        const result = await pool.query(query, [req.params.res_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Lỗi Server'); }
});

// 14. Báo hỏng nội thất (Vừa tạo Request, vừa update trạng thái đồ)
app.post('/api/resident/report-furniture', async (req, res) => {
    const { res_id, item_id, item_name, description } = req.body;
    try {
        const aptRes = await pool.query("SELECT apt_id FROM contracts WHERE res_id = $1 AND status = 'Active'", [res_id]);
        if(aptRes.rows.length === 0) return res.json({success: false, message: "Lỗi xác thực căn hộ"});
        const apt_id = aptRes.rows[0].apt_id;

        // B1: Update nội thất -> "Đang sửa chữa"
        await pool.query("UPDATE furniture SET condition = 'Đang sửa chữa' WHERE item_id = $1", [item_id]);

        // B2: Tạo Request
        const content = `[Báo hỏng ${item_name}] ${description}`;
        
        await pool.query(
            "INSERT INTO requests (apt_id, content, status, item_id) VALUES ($1, $2, 'New', $3)",
            [apt_id, content, item_id]
        );

        res.json({ success: true, message: "Đã báo hỏng thành công!" });
    } catch (err) { 
        console.error("LỖI REPORT FURNITURE:", err); // Log lỗi ra terminal
        res.status(500).json({ success: false, message: "Lỗi Server Database" }); 
    }
});

// 15. Lấy Bảng giá dịch vụ
app.get('/api/resident/services-price', async (req, res) => {
    try {
        const result = await pool.query("SELECT name, unit_price FROM services ORDER BY service_id");
        res.json(result.rows);
    } catch (err) { res.status(500).send('Lỗi Server'); }
});

// 16. Đổi mật khẩu
app.post('/api/change-password', async (req, res) => {
    const { username, oldPass, newPass } = req.body;
    try {
        // Kiểm tra pass cũ
        const check = await pool.query("SELECT * FROM accounts WHERE username = $1 AND password = $2", [username, oldPass]);
        if(check.rows.length === 0) {
            return res.json({ success: false, message: "Mật khẩu cũ không đúng!" });
        }
        // Cập nhật pass mới
        await pool.query("UPDATE accounts SET password = $1 WHERE username = $2", [newPass, username]);
        res.json({ success: true, message: "Đổi mật khẩu thành công!" });
    } catch (err) { res.status(500).json({ success: false, message: "Lỗi Server" }); }
});
// 18. Khôi phục xe (Hủy yêu cầu hủy xe)
app.post('/api/resident/undo-cancel-vehicle', async (req, res) => {
    const { vehicle_id } = req.body;
    try {
        await pool.query(
            "UPDATE vehicles SET status = 'Active' WHERE vehicle_id = $1 AND status = 'Pending_Cancellation'",
            [vehicle_id]
        );
        res.json({ success: true, message: "Đã khôi phục trạng thái xe thành công!" });
    } catch (err) { 
        console.error(err); // In lỗi ra terminal 
        res.status(500).json({ success: false, message: "Lỗi Server Undo" }); 
    }
});
// ==========================================
// API ADMIN (QUẢN TRỊ VIÊN)
// ==========================================

// 1. Lấy Thống kê Dashboard
app.get('/api/admin/stats', async (req, res) => {
    try {
        const totalApt = await pool.query("SELECT COUNT(*) FROM apartments");
        const emptyApt = await pool.query("SELECT COUNT(*) FROM apartments WHERE status = 0");
        const pendingReq = await pool.query("SELECT COUNT(*) FROM requests WHERE status = 'New'");
        const pendingVeh = await pool.query("SELECT COUNT(*) FROM vehicles WHERE status = 'Pending' OR status = 'Pending_Cancellation'");

        res.json({
            total_apts: totalApt.rows[0].count,
            empty_apts: emptyApt.rows[0].count,
            pending_requests: pendingReq.rows[0].count,
            pending_vehicles: pendingVeh.rows[0].count
        });
    } catch (err) { res.status(500).send('Lỗi Server'); }
});

// 2. Lấy danh sách Yêu cầu (Kèm tên căn hộ để biết ai gửi)
app.get('/api/admin/requests', async (req, res) => {
    try {
        const query = `
            SELECT r.request_id, r.content, r.status, r.item_id, apt.apt_code
            FROM requests r
            JOIN apartments apt ON r.apt_id = apt.apt_id
            ORDER BY 
                CASE WHEN r.status = 'New' THEN 1 ELSE 2 END, -- Ưu tiên New lên đầu
                r.request_id DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Lỗi Server'); }
});

// 3. Xử lý Yêu cầu (Duyệt / Hoàn thành)
app.post('/api/admin/update-request-status', async (req, res) => {
    const { request_id, status, item_id } = req.body;
    try {
        // Cập nhật trạng thái yêu cầu
        await pool.query("UPDATE requests SET status = $1 WHERE request_id = $2", [status, request_id]);

        // Nếu Admin bấm "Done" (Đã sửa xong) VÀ yêu cầu này liên quan đến nội thất
        // -> Tự động chuyển nội thất về "Đang hoạt động"
        if (status === 'Done' && item_id) {
            await pool.query("UPDATE furniture SET condition = 'Đang hoạt động' WHERE item_id = $1", [item_id]);
        }

        res.json({ success: true, message: "Đã cập nhật trạng thái!" });
    } catch (err) { res.status(500).json({ success: false }); }
});

// 4. Lấy danh sách Xe cần duyệt (Pending & Pending_Cancellation)
app.get('/api/admin/vehicles-pending', async (req, res) => {
    try {
        const query = `
            SELECT v.vehicle_id, v.license_plate, v.type, v.status, apt.apt_code
            FROM vehicles v
            JOIN apartments apt ON v.apt_id = apt.apt_id
            WHERE v.status IN ('Pending', 'Pending_Cancellation')
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Lỗi Server'); }
});

// 5. Duyệt Xe (Đồng ý đăng ký hoặc Đồng ý hủy)
app.post('/api/admin/approve-vehicle', async (req, res) => {
    const { vehicle_id, action } = req.body; // action: 'Approve' hoặc 'Reject'
    try {
        // Lấy trạng thái hiện tại
        const check = await pool.query("SELECT status FROM vehicles WHERE vehicle_id = $1", [vehicle_id]);
        const currentStatus = check.rows[0].status;

        let newStatus = '';
        
        if (currentStatus === 'Pending') {
            // Đang xin đăng ký -> Duyệt thành Active, Từ chối thành Rejected
            newStatus = (action === 'Approve') ? 'Active' : 'Rejected';
        } else if (currentStatus === 'Pending_Cancellation') {
            // Đang xin hủy -> Duyệt thành Cancelled (Hủy hẳn), Từ chối thì quay về Active
            newStatus = (action === 'Approve') ? 'Cancelled' : 'Active';
        }

        // Cập nhật Database
        await pool.query("UPDATE vehicles SET status = $1 WHERE vehicle_id = $2", [newStatus, vehicle_id]);
        
        // Nếu duyệt xe ô tô -> Gán tạm vào Slot mặc định (Logic nâng cao làm sau)
        // ...

        res.json({ success: true, message: "Đã xử lý hồ sơ xe!" });
    } catch (err) { res.status(500).json({ success: false }); }
});

// 1. Quản lý Căn hộ & Bãi xe (Dashboard nâng cao)
app.get('/api/admin/apartment-parking-status', async (req, res) => {
    try {
        // Lấy danh sách căn hộ
        const apts = await pool.query("SELECT * FROM apartments ORDER BY apt_code");
        
        // Đếm tổng chỗ đậu xe Oto (Giả sử quy hoạch: Tổng slot Oto = Tổng số căn hộ)
        const totalCarSlots = apts.rows.length; 
        
        // Đếm số xe Oto đang Active (đã chiếm chỗ)
        const usedCarSlots = await pool.query("SELECT COUNT(*) FROM vehicles WHERE type = 'Car' AND status = 'Active'");

        res.json({
            apartments: apts.rows,
            parking: {
                total: totalCarSlots,
                used: parseInt(usedCarSlots.rows[0].count)
            }
        });
    } catch (err) { res.status(500).send('Lỗi Server'); }
});

// 2. Lấy danh sách Khách cần tư vấn
app.get('/api/admin/consultations', async (req, res) => {
    try {
        const query = `
            SELECT c.*, a.apt_code 
            FROM consultations c
            LEFT JOIN apartments a ON c.apt_id = a.apt_id
            ORDER BY c.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Lỗi Server'); }
});

// 3. Tạo Tài khoản + Hợp đồng cho khách
app.post('/api/admin/create-contract', async (req, res) => {
    const { consul_id, username, password, full_name, phone, email, apt_id } = req.body;
    
    const client = await pool.connect(); 
    try {
        await client.query('BEGIN');

        // B1: TẠO RESIDENT (Để lấy res_id)
        const resQuery = `
            INSERT INTO residents (full_name, phone, email) 
            VALUES ($1, $2, $3) 
            RETURNING res_id
        `;
        const resRes = await client.query(resQuery, [full_name, phone, email]);
        const resId = resRes.rows[0].res_id;

        // B2: TẠO ACCOUNT (Và gắn res_id vừa tạo vào đây)
        const accQuery = `
            INSERT INTO accounts (username, password, role, res_id) 
            VALUES ($1, $2, 'resident', $3)
        `;
        await client.query(accQuery, [username, password, resId]);

        // B3: TẠO HỢP ĐỒNG
        await client.query(
            "INSERT INTO contracts (res_id, apt_id, start_date, status) VALUES ($1, $2, CURRENT_DATE, 'Active')",
            [resId, apt_id]
        );

        // B4: Cập nhật trạng thái căn hộ -> Đã thuê (Status = 1)
        await client.query("UPDATE apartments SET status = 1 WHERE apt_id = $1", [apt_id]);

        // B5: Cập nhật trạng thái phiếu tư vấn -> Contracted
        await client.query("UPDATE consultations SET status = 'Contracted' WHERE consul_id = $1", [consul_id]);

        await client.query('COMMIT');
        res.json({ success: true, message: "🎉 Chốt đơn thành công! Đã tạo tài khoản và hợp đồng." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ LỖI TẠO HỢP ĐỒNG:", err);
        
        // Kiểm tra lỗi trùng Username
        if (err.code === '23505') { 
            return res.status(400).json({ success: false, message: "Lỗi: Username hoặc SĐT này đã tồn tại!" });
        }

        res.status(500).json({ success: false, message: "Lỗi DB: " + err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// API BẢN ĐỒ ADMIN 
// ==========================================
app.get('/api/admin/map-apartments', async (req, res) => {
    try {
        const query = `
            SELECT 
                a.apt_code, 
                a.status,
                -- 1. Điều kiện báo ĐỎ: Có yêu cầu là 'New' HOẶC 'Processing'
                (SELECT COUNT(*) FROM requests r 
                 WHERE r.apt_id = a.apt_id AND r.status IN ('New', 'Processing')) > 0 as has_issue,
                
                -- 2. Gom nội dung lỗi lại để hiện Popup (Ví dụ: "- Hỏng loa<br>- Hỏng đèn")
                (SELECT STRING_AGG(CONCAT('• [', r.status, '] ', r.content), '<br/>') 
                 FROM requests r 
                 WHERE r.apt_id = a.apt_id AND r.status IN ('New', 'Processing')) as issue_list
            FROM apartments a
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi Map Admin:", err);
        res.status(500).send('Lỗi Server');
    }
});
// --- QUẢN LÝ CƯ DÂN & TRẢ PHÒNG ---

//Lấy danh sách cư dân ĐANG HOẠT ĐỘNG (Có hợp đồng Active)
app.get('/api/admin/residents', async (req, res) => {
    try {
        const query = `
            SELECT 
                r.res_id, r.full_name, r.phone, r.email,
                a.apt_code, c.start_date, ac.username
            FROM residents r
            JOIN contracts c ON r.res_id = c.res_id
            JOIN apartments a ON c.apt_id = a.apt_id
            LEFT JOIN accounts ac ON r.res_id = ac.res_id
            WHERE c.status = 'Active' -- Chỉ lấy người đang ở
            ORDER BY a.apt_code ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).send("Lỗi Server"); }
});

// TRẢ PHÒNG 
// Logic: Hủy hợp đồng -> Khóa tài khoản -> Đổi trạng thái căn hộ về 0 (Trống)
app.post('/api/admin/move-out', async (req, res) => {
    const { res_id, apt_code } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Tìm apt_id từ apt_code
        const aptRes = await client.query("SELECT apt_id FROM apartments WHERE apt_code = $1", [apt_code]);
        if(aptRes.rows.length === 0) throw new Error("Không tìm thấy căn hộ");
        const apt_id = aptRes.rows[0].apt_id;

        // 2. Cập nhật Hợp đồng -> Ended
        await client.query("UPDATE contracts SET status = 'Ended', end_date = CURRENT_DATE WHERE res_id = $1 AND status = 'Active'", [res_id]);

        // 3. Khóa tài khoản (Để họ không đăng nhập báo sửa chữa linh tinh nữa)
        await client.query("UPDATE accounts SET role = 'inactive' WHERE res_id = $1", [res_id]);

        // 4. Reset Căn hộ -> Trống (Status = 0)
        await client.query("UPDATE apartments SET status = 0 WHERE apt_id = $1", [apt_id]);

        await client.query('COMMIT');
        res.json({ success: true, message: `✅ Đã hoàn tất trả phòng cho căn ${apt_code}` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi: " + err.message });
    } finally {
        client.release();
    }
});
// --- LỊCH SỬ CĂN HỘ ---
app.get('/api/admin/apartment-history/:aptCode', async (req, res) => {
    try {
        const { aptCode } = req.params;
        const client = await pool.connect();
        
        // 1. Lấy ID căn hộ
        const aptRes = await client.query("SELECT apt_id FROM apartments WHERE apt_code = $1", [aptCode]);
        if(aptRes.rows.length === 0) return res.json({ residents: [], requests: [] });
        const apt_id = aptRes.rows[0].apt_id;

        // 2. Lấy danh sách người từng ở (Bao gồm cả đã chuyển đi)
        const historyResidents = await client.query(`
            SELECT r.full_name, c.start_date, c.end_date, c.status
            FROM contracts c
            JOIN residents r ON c.res_id = r.res_id
            WHERE c.apt_id = $1
            ORDER BY c.start_date DESC
        `, [apt_id]);

        // 3. Lấy lịch sử sửa chữa
        const historyRequests = await client.query(`
            SELECT content, status, created_at
            FROM requests
            WHERE apt_id = $1
            ORDER BY created_at DESC
        `, [apt_id]);

        client.release();
        res.json({ residents: historyResidents.rows, requests: historyRequests.rows });

    } catch (err) { res.status(500).send("Lỗi Server"); }
});
// RESET PASSWORD
app.post('/api/admin/reset-password', async (req, res) => {
    const { res_id } = req.body;
    try {
        // Reset về '123456'
        await pool.query("UPDATE accounts SET password = '123456' WHERE res_id = $1", [res_id]);
        res.json({ success: true, message: "Đã reset mật khẩu thành công về: 123456" });
    } catch (err) { res.status(500).json({ success: false, message: "Lỗi DB" }); }
});
// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================
app.listen(port, () => {
  console.log(`Server đang chạy tại: http://localhost:${port}`);
});
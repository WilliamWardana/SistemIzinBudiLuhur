import dotenv from "dotenv";
import express from "express";
import mysql2 from "mysql2/promise";

dotenv.config();

const db = mysql2.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const router = express.Router();

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("id-ID", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

router.get("/", (req, res) => {
  res.render("index", { title: "Sistem Izin Budi Luhur" });
});

router.get("/guru_murid", (req, res) => {
  res.render("guru_murid", { title: "Pilih Status" });
});

router.post("/murid_form", async (req, res) => {
  const nis = req.body.nis;

  res.redirect(`/siswa_form?nis=${nis}`);
});

router.get("/siswa_form", async (req, res) => {
  const nis = req.query.nis;

  const [rows] = await db.execute("SELECT * FROM siswa WHERE nis = ?", [nis]);
  if (rows.length === 0) {
    return res.render("guru_murid", {
      title: "Pilih Status",
      error: "NIS tidak ditemukan!",
    });
  }

  const riwayat = await db.execute(
    "SELECT * FROM izin WHERE nis = ?  AND DATE(created_at) = CURDATE() ORDER BY created_at DESC",
    [nis]
  );

  res.render("siswa_form", {
    title: "Form Izin Siswa",
    nis,
    siswa: rows[0],
    izins: riwayat[0],
    formatDate,
  });
});

router.post("/guru_form", async (req, res) => {
  const password = req.body.password;

  const passwordMap = {
    sayaWakelXA: "X A",
    sayaWakelXB: "X B",
    sayaWakelXC: "X C",
    sayaWakelXD: "X D",
    sayaWakelXE: "X E",
    sayaWakelXIA: "XI A",
    sayaWakelXIB: "XI B",
    sayaWakelXIC: "XI C",
    sayaWakelXID: "XI D",
    sayaWakelXIE: "XI E",
    sayaWakelXIIA: "XII A",
    sayaWakelXIIB: "XII B",
    sayaWakelXIIC: "XII C",
    sayaWakelXIID: "XII D",
    sayaWakelXIIE: "XII E",
    sayaWakelXRPL: "X RPL",
    sayaWakelXIRPL: "XI RPL",
    sayaWakelXIIRPL: "XII RPL",
    sayaWakelXMM: "X MM",
    sayaWakelXIMM: "XI MM",
    sayaWakelXIIMM: "XII MM",
    sayaWakelXBC: "X BC",
    sayaWakelXIBC: "XI BC",
    sayaWakelXIIBC: "XII BC",
  };

  if (passwordMap[password]) {
    req.session.role = passwordMap[password];
    return res.redirect("/guru_form");
  }

  if (password === "sayaKesiswaan") {
    req.session.role = "kesiswaan";
    return res.redirect("/guru_form");
  }

  if (password === "sayaPiket") {
    req.session.role = "piket";
    return res.redirect("/guru_form");
  }

  res.redirect("/guru_murid");
});

router.get("/guru_form", async (req, res) => {
  if (!req.session.role) {
    return res.redirect("/guru_murid");
  }

  let query = "";
  let params = [];

  if (req.session.role === "kesiswaan") {
    query =
      "SELECT * FROM izin WHERE DATE(created_at) = CURDATE() ORDER BY created_at DESC";
    const [izins] = await db.execute(query);
    return res.render("daftar_izin", {
      title: "Daftar Izin Hari Ini",
      izins,
      formatDate,
      role: "kesiswaan",
    });
  } else if (req.session.role === "piket") {
    query =
      "SELECT * FROM izin WHERE DATE(created_at) = CURDATE() ORDER BY created_at DESC";
    const [izins] = await db.execute(query);
    return res.render("daftar_izin", {
      title: "Daftar Izin Hari Ini",
      izins,
      formatDate,
      role: "piket",
    });
  } else {
    query =
      "SELECT * FROM izin WHERE kelas = ? AND DATE(created_at) = CURDATE() ORDER BY created_at DESC";
    params = [req.session.role];
    const [izins] = await db.execute(query, params);
    return res.render("daftar_izin", {
      title: "Daftar Izin Hari Ini",
      izins,
      formatDate,
      role: "wakel",
    });
  }
});

router.post("/siswa/izin", async (req, res) => {
  const { nis, nama, kelas, peminatan, keperluan, jam, menit } = req.body;
  const jamSelesai = `${jam}:${menit}:00`;
  const kelasFull = `${kelas} ${peminatan}`;

  const [rows] = await db.execute("SELECT * FROM siswa WHERE nis = ?", [nis]);

  if (rows.length === 0) {
    return res.render("guru_murid", {
      title: "Pilih Status",
      error: "NIS tidak ditemukan!",
    });
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO izin (nis, nama, kelas, keperluan, jam_selesai) VALUES (?, ?, ?, ?, ?)",
      [nis, nama, kelasFull, keperluan, jamSelesai]
    );

    const izinId = result.insertId;
    res.redirect(`/siswa/izin/success/${izinId}`);
  } catch (error) {
    console.error(error);
    res.send("Terjadi kesalahan saat mengajukan izin.");
  }
});

router.get("/siswa/izin/success/:id", async (req, res) => {
  const izinId = req.params.id;

  try {
    const [izinRows] = await db.execute("SELECT * FROM izin WHERE id = ?", [
      izinId,
    ]);

    if (izinRows.length === 0) {
      return res.send("Data izin tidak ditemukan.");
    }

    res.render("izin_success", {
      title: "Izin Berhasil Diajukan",
      izin: izinRows[0],
      formatDate,
    });
  } catch (error) {
    console.error(error);
    res.send("Terjadi kesalahan saat mengambil data izin.");
  }
});

router.get("/accept_wakel/:id", async (req, res) => {
  const izinId = req.params.id;
  const kelasMurid = await db.execute("SELECT kelas FROM izin WHERE id = ?", [
    izinId,
  ]);

  try {
    await db.execute('UPDATE izin SET status = "accwakel" WHERE id = ?', [
      izinId,
    ]);
    res.redirect(
      `/guru_form?password=sayaWakel${kelasMurid[0][0].kelas.replace(" ", "")}`
    );
  } catch (error) {
    console.error(error);
    res.send("Terjadi kesalahan saat mengizinkan izin.");
  }
});

router.get("/accept_kesiswaan/:id", async (req, res) => {
  const izinId = req.params.id;

  try {
    await db.execute('UPDATE izin SET status = "acckesiswaan" WHERE id = ?', [
      izinId,
    ]);
    res.redirect(`/guru_form?password=sayaKesiswaan`);
  } catch (error) {
    console.error(error);
    res.send("Terjadi kesalahan saat mengizinkan izin.");
  }
});

router.get("/accept_piket/:id", async (req, res) => {
  const izinId = req.params.id;

  try {
    await db.execute('UPDATE izin SET status = "accpiket" WHERE id = ?', [
      izinId,
    ]);
    res.redirect(`/guru_form?password=sayaPiket`);
  } catch (error) {
    console.error(error);
    res.send("Terjadi kesalahan saat mengizinkan izin.");
  }
});

router.get("/tolak_izin", async (req, res) => {
  const izinId = req.query.id;
  const role = req.query.role;

  try {
    if (role == "wakel") {
      await db.execute(
        'UPDATE izin SET status = "rejected_wakel" WHERE id = ?',
        [izinId]
      );
    } else if (role == "kesiswaan") {
      await db.execute(
        'UPDATE izin SET status = "rejected_kesiswaan" WHERE id = ?',
        [izinId]
      );
    } else {
      await db.execute(
        'UPDATE izin SET status = "rejected_piket" WHERE id = ?',
        [izinId]
      );
    }
    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.send("Terjadi kesalahan saat menolak izin.");
  }
});

router.get("/bukti_izin", async (req, res) => {
  const status = req.query.status;
  const id = req.query.id;

  const [izinRows] = await db.execute(
    "SELECT * FROM izin WHERE id = ? ORDER BY created_at DESC LIMIT 1",
    [id]
  );
  const izin = izinRows[0];

  res.render("bukti_izin", {
    title: "Bukti Izin Siswa",
    status,
    izin,
    formatDate,
  });
});

export default router;

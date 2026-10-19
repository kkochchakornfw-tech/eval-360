insert into staff_groups (id, name, sort_order) values
  (1, 'เภสัชกร', 1),
  (2, 'เจ้าหน้าที่ห้องยา', 2);

insert into eval_cycles (id, name, is_open, is_current, head_weight, core_weight, job_weight, kpi_weight)
values (1, 'รอบประเมินเริ่มต้น', true, true, 50, 30, 35, 35);

insert into core_groups (id, cycle_id, code, name, sort_order) values
  (1, 1, 'B', 'ความรวดเร็วและความรับผิดชอบ', 1),
  (2, 1, 'D', 'การช่วยเหลือและทำงานเป็นทีม', 2),
  (3, 1, 'M', 'ความมีวินัยและการปฏิบัติตามหน้าที่', 3),
  (4, 1, 'S', 'การสื่อสารและการแก้ปัญหา', 4);

insert into core_questions (group_id, text, sort_order) values
  (1, 'ความรวดเร็วในการทำงาน / ความกระตือรือร้น', 1),
  (1, 'ความละเอียดรอบคอบในการตรวจสอบ', 2),
  (1, 'ความรับผิดชอบต่องานที่ได้รับมอบหมาย', 3),
  (2, 'ช่วยเหลือเพื่อนร่วมงาน เช่น ช่วยงานในแผนก', 1),
  (2, 'การควบคุมอารมณ์ในการทำงาน เช่น การรับมือความเครียด', 2),
  (2, 'ความมีน้ำใจ / การทำงานเป็นทีม', 3),
  (3, 'การเข้างานให้ตรงเวลา', 1),
  (3, 'ไม่ใช้เวลางานในเรื่องส่วนตัวจนมีผลกระทบ', 2),
  (3, 'ทำงานในตำแหน่งที่รับผิดชอบได้อย่างสมบูรณ์', 3),
  (4, 'การสื่อสาร การรับเรื่อง การส่งเวร', 1),
  (4, 'การให้ความช่วยเหลือลูกค้า และการติดต่อประสานงาน', 2),
  (4, 'ความสามารถในการแก้ไขปัญหาเฉพาะหน้า', 3);

-- Job Base: group 1 = pharmacists (jobPharma), group 2 = pharmacy staff (jobStaff)
insert into job_items (cycle_id, staff_group_id, text, weight, sort_order) values
  (1, 1, '% ของการเข้าร่วมประชุมแผนก', 10, 1),
  (1, 1, '% ของการสุ่ม FEFO ประจำเดือน', 10, 2),
  (1, 1, '% ของ Pharmacy Intervention ต่อรายการยาที่ตรวจสอบ', 15, 3),
  (1, 1, 'จำนวน dispensing error ตั้งแต่ level C ขึ้นไป ต่อ 1000 รายการยาที่ตรวจสอบ', 25, 4),
  (1, 1, 'จำนวน dispensing error ของยา HAD ตั้งแต่ level B ขึ้นไป ต่อรายการยา HAD ที่ตรวจสอบ', 25, 5),
  (1, 1, 'มีส่วนร่วมอย่างเป็นรูปธรรมในการพัฒนางานคุณภาพของหน่วยงาน', 15, 6),
  (1, 2, '% ของการเข้าร่วมประชุมแผนก', 15, 1),
  (1, 2, '% ที่พบการไม่จัดเรียงยาตาม FEFO', 30, 2),
  (1, 2, '% ของการตรวจสอบวันหมดอายุยาประจำเดือน', 30, 3),
  (1, 2, 'จำนวน Pre-dispensing error ต่อ 1000 รายการยาที่จัด', 25, 4);

select setval(pg_get_serial_sequence('staff_groups', 'id'), (select max(id) from staff_groups));
select setval(pg_get_serial_sequence('eval_cycles', 'id'), (select max(id) from eval_cycles));
select setval(pg_get_serial_sequence('core_groups', 'id'), (select max(id) from core_groups));

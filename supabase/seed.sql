insert into staff_groups (id, name, sort_order) values
  (1, 'เภสัชกร', 1),
  (2, 'เจ้าหน้าที่ห้องยา', 2);

insert into eval_cycles (id, name, is_open, is_current, head_weight, core_weight, job_weight, kpi_weight)
values (1, 'รอบประเมินเริ่มต้น', true, true, 50, 30, 35, 35);

insert into core_groups (id, cycle_id, code, name, sort_order) values
  (1, 1, 'B', 'Beyond Excellent', 1),
  (2, 1, 'D', 'Deep Empathy', 2),
  (3, 1, 'M', 'Moral commitment', 3),
  (4, 1, 'S', 'Service with Thai hospitality', 4);

insert into core_questions (group_id, text, sort_order) values
  (1, 'ปฏิบัติตามบทบาทหน้าที่ของตนได้เป็นอย่างดีและมีการพัฒนาตนเองอย่างต่อเนื่อง', 1),
  (1, 'ปฏิบัติงานอย่างทุ่มเท ลงมือทำสิ่งจำเป็นเพื่อให้งานสำเร็จ', 2),
  (1, 'มีส่วนร่วมในการนำเสนอแนวทางการทำงานใหม่ๆ รวมถึงแนวทางแก้ไขปัญหาที่เกิดขึ้น', 3),
  (2, 'ปฎิบัติต่อลูกค้าและเพื่อนร่วมงานในทีมและนอกทีมด้วยความเห็นใจและความเคารพ', 1),
  (2, 'เปิดใจรับฟังและเคารพในความคิดเห็นของผู้อื่น', 2),
  (2, 'สร้างความสัมพันธ์อันดี เพื่อให้เกิดความไว้วางใจซึ่งกันและกันด้วยความเป็นมืออาชีพ', 3),
  (3, 'ปฏิบัติตามกฎระเบียบวินัยของหน่วยงานและองค์กร เช่น เข้างานตรงเวลา ในเวลางานให้ความสำคัญเรื่องงานมากกว่าเรื่องส่วนตัว มีความซื่อสัตย์', 1),
  (3, 'มีความรับผิดชอบต่องานที่ได้รับมอบหมาย', 2),
  (3, 'เต็มใจช่วยเหลือเพื่อนร่วมงานหากพบเจอปัญหา หรือเจอสถานการณ์ที่ยุ่ง', 3),
  (4, 'ความสามารถในการแก้ไขปัญหาเฉพาะหน้า', 1),
  (4, 'สื่อสารอย่างมีประสิทธิภาพ (สื่อสารเข้าใจ ตรงประเด็น, ชี้แจงเหตุผล, ควบคุมอารมณ์)', 2),
  (4, 'พร้อมให้ความช่วยเหลือทั้งลูกค้าภายนอกและลูกค้าภายใน', 3);

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

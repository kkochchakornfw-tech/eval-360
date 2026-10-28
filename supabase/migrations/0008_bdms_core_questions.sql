-- Replace Core Competency (B-D-M-S) wording with the BDMS form, in place for every cycle
-- (keeps group/question ids so saved answers are preserved).
update core_groups set name = 'Beyond Excellent' where code = 'B';
update core_groups set name = 'Deep Empathy' where code = 'D';
update core_groups set name = 'Moral commitment' where code = 'M';
update core_groups set name = 'Service with Thai hospitality' where code = 'S';
update core_questions set text = 'ปฏิบัติตามบทบาทหน้าที่ของตนได้เป็นอย่างดีและมีการพัฒนาตนเองอย่างต่อเนื่อง' where sort_order = 1 and group_id in (select id from core_groups where code = 'B');
update core_questions set text = 'ปฏิบัติงานอย่างทุ่มเท ลงมือทำสิ่งจำเป็นเพื่อให้งานสำเร็จ' where sort_order = 2 and group_id in (select id from core_groups where code = 'B');
update core_questions set text = 'มีส่วนร่วมในการนำเสนอแนวทางการทำงานใหม่ๆ รวมถึงแนวทางแก้ไขปัญหาที่เกิดขึ้น' where sort_order = 3 and group_id in (select id from core_groups where code = 'B');
update core_questions set text = 'ปฎิบัติต่อลูกค้าและเพื่อนร่วมงานในทีมและนอกทีมด้วยความเห็นใจและความเคารพ' where sort_order = 1 and group_id in (select id from core_groups where code = 'D');
update core_questions set text = 'เปิดใจรับฟังและเคารพในความคิดเห็นของผู้อื่น' where sort_order = 2 and group_id in (select id from core_groups where code = 'D');
update core_questions set text = 'สร้างความสัมพันธ์อันดี เพื่อให้เกิดความไว้วางใจซึ่งกันและกันด้วยความเป็นมืออาชีพ' where sort_order = 3 and group_id in (select id from core_groups where code = 'D');
update core_questions set text = 'ปฏิบัติตามกฎระเบียบวินัยของหน่วยงานและองค์กร เช่น เข้างานตรงเวลา ในเวลางานให้ความสำคัญเรื่องงานมากกว่าเรื่องส่วนตัว มีความซื่อสัตย์' where sort_order = 1 and group_id in (select id from core_groups where code = 'M');
update core_questions set text = 'มีความรับผิดชอบต่องานที่ได้รับมอบหมาย' where sort_order = 2 and group_id in (select id from core_groups where code = 'M');
update core_questions set text = 'เต็มใจช่วยเหลือเพื่อนร่วมงานหากพบเจอปัญหา หรือเจอสถานการณ์ที่ยุ่ง' where sort_order = 3 and group_id in (select id from core_groups where code = 'M');
update core_questions set text = 'ความสามารถในการแก้ไขปัญหาเฉพาะหน้า' where sort_order = 1 and group_id in (select id from core_groups where code = 'S');
update core_questions set text = 'สื่อสารอย่างมีประสิทธิภาพ (สื่อสารเข้าใจ ตรงประเด็น, ชี้แจงเหตุผล, ควบคุมอารมณ์)' where sort_order = 2 and group_id in (select id from core_groups where code = 'S');
update core_questions set text = 'พร้อมให้ความช่วยเหลือทั้งลูกค้าภายนอกและลูกค้าภายใน' where sort_order = 3 and group_id in (select id from core_groups where code = 'S');

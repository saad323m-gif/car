const LANGUAGE_STORAGE_KEY = 'car-management-language';
const SUPPORTED_LANGUAGES = new Set(['en', 'ar']);

const translations = {
    en: {
        'System Management': 'System Management',
        'Car Management System': 'Car Management System',
        'Loading system...': 'Loading system...',
        'Loading dashboard...': 'Loading dashboard...',
        'Refresh Page': 'Refresh Page',
        'Change Password': 'Change Password',
        'Logout': 'Logout',
        'Cars': 'Cars',
        'My Violations': 'My Violations',
        'My Activity': 'My Activity',
        'Members': 'Members',
        'Requests': 'Requests',
        'Logs': 'Logs',
        'Search': 'Search',
        'Stats': 'Stats',
        'Violations': 'Violations',
        'Login': 'Login',
        'Email': 'Email',
        'Password': 'Password',
        'Remember Me': 'Remember Me',
        'Loading...': 'Loading...',
        'Save': 'Save',
        'Cancel': 'Cancel',
        'Close': 'Close',
        'Edit': 'Edit',
        'Delete': 'Delete',
        'Add': 'Add',
        'Back': 'Back',
        'Confirm': 'Confirm',
        'Yes': 'Yes',
        'No': 'No',
        'All': 'All',
        'Load More': 'Load More',
        'No records found.': 'No records found.',
        'No data available.': 'No data available.',
        'Access Denied': 'Access Denied',
        'You do not have permission to view this page.': 'You do not have permission to view this page.',
        'Network or service issue. Please check your connection and retry.': 'Network or service issue. Please check your connection and retry.',
        'Unable to complete the request. Please try again.': 'Unable to complete the request. Please try again.',
        'Invalid email or password.': 'Invalid email or password.',
        'Please enter a valid email address.': 'Please enter a valid email address.',
        'This email address is already registered.': 'This email address is already registered.',
        'Password does not meet the security requirements.': 'Password does not meet the security requirements.',
        'Too many attempts. Please wait a few minutes and try again.': 'Too many attempts. Please wait a few minutes and try again.',
        'For security, please sign in again before continuing.': 'For security, please sign in again before continuing.',
        'You do not have permission to complete this action.': 'You do not have permission to complete this action.',
        'Cars Management': 'Cars Management',
        'All Rights Reserved': 'All Rights Reserved',
        'Plate Number (Digits)': 'Plate Number (Digits)',
        'Plate Code': 'Plate Code',
        'Emirate': 'Emirate',
        'Type (Make)': 'Type (Make)',
        'Owner Name': 'Owner Name',
        'VIN': 'VIN',
        'Manufacture Year': 'Manufacture Year',
        'License Expiry': 'License Expiry',
        'Insurance Expiry': 'Insurance Expiry',
        'Notes': 'Notes',
        'Add Car': 'Add Car',
        'Save Changes': 'Save Changes',
        'Add New Car': 'Add New Car',
        'Cars List (Sorted by License Expiry)': 'Cars List (Sorted by License Expiry)',
        'Expired': 'Expired',
        'Expiring Soon': 'Expiring Soon',
        'Assigned': 'Assigned',
        'Unassigned': 'Unassigned',
        'Vehicle Identification Number': 'Vehicle Identification Number',
        'Members Management': 'Members Management',
        'Add New Member': 'Add New Member',
        'Members List': 'Members List',
        'Username': 'Username',
        'Phone Number': 'Phone Number',
        'Role': 'Role',
        'Status': 'Status',
        'Active': 'Active',
        'Suspended': 'Suspended',
        'Admin': 'Admin',
        'User': 'User',
        'Protected Administrator': 'Protected Administrator',
        'Edit My Profile': 'Edit My Profile',
        'Current Password': 'Current Password',
        'Current Security PIN (4 digits)': 'Current Security PIN (4 digits)',
        'New Security PIN (4 digits)': 'New Security PIN (4 digits)',
        'New Security PIN (4 digits, optional)': 'New Security PIN (4 digits, optional)',
        'Requests Management': 'Requests Management',
        'Pending': 'Pending',
        'Approved': 'Approved',
        'Rejected': 'Rejected',
        'Cancelled': 'Cancelled',
        'Search System': 'Search System',
        'Search Results': 'Search Results',
        'System Statistics': 'System Statistics',
        'Activity Logs': 'Activity Logs',
        'Violations Management': 'Violations Management',
        '+ Add Violation': '+ Add Violation',
        'Car Not Found': 'Car Not Found',
        'No Assignment': 'No Assignment',
        'Review Required': 'Review Required',
        'Unsettled': 'Unsettled',
        'Settled': 'Settled',
        'Linked': 'Linked',
        'Matching keys': 'Matching keys',
        'Violation Date & Time (UAE, GMT+4)': 'Violation Date & Time (UAE, GMT+4)',
        'Violation Type': 'Violation Type',
        'Reference Number': 'Reference Number',
        'Location': 'Location',
        'Amount': 'Amount',
        'Save and Match Violation': 'Save and Match Violation',
        'Settlement': 'Settlement',
        'Settlement Method': 'Settlement Method',
        'Settlement Notes': 'Settlement Notes',
        'Mark as Settled': 'Mark as Settled',
        'Year': 'Year',
        'Month': 'Month',
        'Day': 'Day',
        'Hour': 'Hour',
        'Minute': 'Minute',
        'AM/PM': 'AM/PM',
        'Jan': 'Jan', 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Apr', 'May': 'May', 'Jun': 'Jun',
        'Jul': 'Jul', 'Aug': 'Aug', 'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dec': 'Dec',
        'Abu Dhabi': 'Abu Dhabi',
        'Dubai': 'Dubai',
        'Sharjah': 'Sharjah',
        'Ajman': 'Ajman',
        'Fujairah': 'Fujairah',
        'Umm Al Quwain': 'Umm Al Quwain',
        'Ras Al Khaimah': 'Ras Al Khaimah',
        'Other': 'Other',
        'From': 'From',
        'to': 'to',
        'Now': 'Now',
        'N/A': 'N/A',
        'Unknown Car': 'Unknown Car',
        'Car Management System — All Rights Reserved': 'Car Management System — All Rights Reserved'
    },
    ar: {
        'System Management': 'نظام الإدارة',
        'Car Management System': 'نظام إدارة المركبات',
        'Loading system...': 'جارٍ تحميل النظام...',
        'Loading dashboard...': 'جارٍ تحميل لوحة التحكم...',
        'Refresh Page': 'تحديث الصفحة',
        'Change Password': 'تغيير كلمة المرور',
        'Logout': 'تسجيل الخروج',
        'Cars': 'المركبات',
        'My Violations': 'مخالفاتي',
        'My Activity': 'نشاطي',
        'Members': 'الأعضاء',
        'Requests': 'الطلبات',
        'Logs': 'السجلات',
        'Search': 'البحث',
        'Stats': 'الإحصاءات',
        'Violations': 'المخالفات',
        'Login': 'تسجيل الدخول',
        'Email': 'البريد الإلكتروني',
        'Password': 'كلمة المرور',
        'Remember Me': 'تذكرني',
        'Loading...': 'جارٍ التحميل...',
        'Save': 'حفظ',
        'Cancel': 'إلغاء',
        'Close': 'إغلاق',
        'Edit': 'تعديل',
        'Delete': 'حذف',
        'Add': 'إضافة',
        'Back': 'رجوع',
        'Confirm': 'تأكيد',
        'Yes': 'نعم',
        'No': 'لا',
        'All': 'الكل',
        'Load More': 'عرض المزيد',
        'No records found.': 'لا توجد سجلات.',
        'No data available.': 'لا توجد بيانات متاحة.',
        'Access Denied': 'تم رفض الوصول',
        'You do not have permission to view this page.': 'ليس لديك إذن لعرض هذه الصفحة.',
        'Network or service issue. Please check your connection and retry.': 'توجد مشكلة في الشبكة أو الخدمة. تحقق من الاتصال ثم أعد المحاولة.',
        'Unable to complete the request. Please try again.': 'تعذر إتمام الطلب. يرجى إعادة المحاولة.',
        'Invalid email or password.': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
        'Please enter a valid email address.': 'يرجى إدخال بريد إلكتروني صحيح.',
        'This email address is already registered.': 'هذا البريد الإلكتروني مسجل بالفعل.',
        'Password does not meet the security requirements.': 'كلمة المرور لا تستوفي متطلبات الأمان.',
        'Too many attempts. Please wait a few minutes and try again.': 'محاولات كثيرة. انتظر بضع دقائق ثم أعد المحاولة.',
        'For security, please sign in again before continuing.': 'لأسباب أمنية، يرجى تسجيل الدخول مجدداً قبل المتابعة.',
        'You do not have permission to complete this action.': 'ليس لديك إذن لإتمام هذا الإجراء.',
        'Cars Management': 'إدارة المركبات',
        'All Rights Reserved': 'جميع الحقوق محفوظة',
        'Plate Number (Digits)': 'رقم اللوحة (أرقام)',
        'Plate Code': 'رمز اللوحة',
        'Emirate': 'الإمارة',
        'Type (Make)': 'النوع (الشركة/الطراز)',
        'Owner Name': 'اسم المالك',
        'Owner Traffic Code (Optional)': 'الرمز المروري للمالك (اختياري)',
        'Owner Traffic Code': 'الرمز المروري للمالك',
        'Current Assignee': 'المستخدم الحالي للعهدة',
        'VIN': 'رقم الهيكل VIN',
        'Manufacture Year': 'سنة الصنع',
        'License Expiry': 'انتهاء الترخيص',
        'Insurance Expiry': 'انتهاء التأمين',
        'Notes': 'ملاحظات',
        'Add Car': 'إضافة مركبة',
        'Save Changes': 'حفظ التغييرات',
        'Add New Car': 'إضافة مركبة جديدة',
        'Cars List (Sorted by License Expiry)': 'قائمة المركبات (مرتبة حسب انتهاء الترخيص)',
        'Expired': 'منتهي',
        'Expiring Soon': 'ينتهي قريباً',
        'Assigned': 'بعهدة مستخدم',
        'Unassigned': 'غير مسندة',
        'Vehicle Identification Number': 'رقم تعريف المركبة',
        'Members Management': 'إدارة الأعضاء',
        'Add New Member': 'إضافة عضو جديد',
        'Members List': 'قائمة الأعضاء',
        'Username': 'اسم المستخدم',
        'Phone Number': 'رقم الهاتف',
        'Role': 'الدور',
        'Status': 'الحالة',
        'Active': 'نشط',
        'Suspended': 'موقوف',
        'Admin': 'مدير',
        'User': 'مستخدم',
        'Protected Administrator': 'المدير المحمي',
        'Edit My Profile': 'تعديل ملفي الشخصي',
        'Current Password': 'كلمة المرور الحالية',
        'Current Security PIN (4 digits)': 'رمز PIN الأمني الحالي (4 أرقام)',
        'New Security PIN (4 digits)': 'رمز PIN الأمني الجديد (4 أرقام)',
        'New Security PIN (4 digits, optional)': 'رمز PIN الأمني الجديد (4 أرقام، اختياري)',
        'Requests Management': 'إدارة الطلبات',
        'Pending': 'قيد الانتظار',
        'Approved': 'مقبول',
        'Rejected': 'مرفوض',
        'Cancelled': 'ملغى',
        'Search System': 'البحث في النظام',
        'Search Results': 'نتائج البحث',
        'System Statistics': 'إحصاءات النظام',
        'Activity Logs': 'سجل النشاط',
        'Violations Management': 'إدارة المخالفات',
        '+ Add Violation': '+ إضافة مخالفة',
        'Car Not Found': 'لم يتم العثور على المركبة',
        'No Assignment': 'لا توجد عهدة',
        'Review Required': 'تتطلب مراجعة',
        'Unsettled': 'غير مسواة',
        'Settled': 'تمت التسوية',
        'Linked': 'مرتبطة',
        'Matching keys': 'بيانات المطابقة',
        'Violation Date & Time (UAE, GMT+4)': 'تاريخ ووقت المخالفة (الإمارات، GMT+4)',
        'Violation Type': 'نوع المخالفة',
        'Reference Number': 'الرقم المرجعي',
        'Location': 'الموقع',
        'Amount': 'المبلغ',
        'Save and Match Violation': 'حفظ ومطابقة المخالفة',
        'Settlement': 'التسوية',
        'Settlement Method': 'طريقة التسوية',
        'Settlement Notes': 'ملاحظات التسوية',
        'Mark as Settled': 'تحديد كمُسوّاة',
        'Year': 'السنة',
        'Month': 'الشهر',
        'Day': 'اليوم',
        'Hour': 'الساعة',
        'Minute': 'الدقيقة',
        'AM/PM': 'AM/PM',
        'Jan': 'يناير', 'Feb': 'فبراير', 'Mar': 'مارس', 'Apr': 'أبريل', 'May': 'مايو', 'Jun': 'يونيو',
        'Jul': 'يوليو', 'Aug': 'أغسطس', 'Sep': 'سبتمبر', 'Oct': 'أكتوبر', 'Nov': 'نوفمبر', 'Dec': 'ديسمبر',
        'Abu Dhabi': 'أبوظبي',
        'Dubai': 'دبي',
        'Sharjah': 'الشارقة',
        'Ajman': 'عجمان',
        'Fujairah': 'الفجيرة',
        'Umm Al Quwain': 'أم القيوين',
        'Ras Al Khaimah': 'رأس الخيمة',
        'Other': 'أخرى',
        'From': 'من',
        'to': 'إلى',
        'Now': 'الآن',
        'N/A': 'غير متاح',
        'Unknown Car': 'مركبة غير معروفة',
        'Car Management System — All Rights Reserved': 'نظام إدارة المركبات — جميع الحقوق محفوظة'
    }
};

Object.assign(translations.ar, {
    'Phone': 'الهاتف',
    'Notes (Admin only)': 'ملاحظات (للمدير فقط)',
    'Edit Protected Profile': 'تعديل الملف المحمي',
    'New Username': 'اسم المستخدم الجديد',
    'New Phone': 'رقم الهاتف الجديد',
    'Confirm New Security PIN': 'تأكيد رمز PIN الأمني الجديد',
    'Verify & Update': 'تحقق وحدّث',
    'My Personal Activity': 'نشاطي الشخصي',
    'System Logs Timeline': 'الخط الزمني لسجل النظام',
    'System Search': 'البحث في النظام',
    'Search Results': 'نتائج البحث',
    'Confirm Official Settlement': 'تأكيد التسوية الرسمية',
    'Settlement Note': 'ملاحظة التسوية',
    'Confirm Settlement': 'تأكيد التسوية',
    'Activity': 'النشاط',
    'Add Violation': 'إضافة مخالفة',
    'Promote': 'ترقية',
    'Demote': 'إزالة صلاحية الإدارة',
    'Suspend': 'إيقاف',
    'Activate': 'تفعيل',
    'Linked': 'مرتبطة',
    'No car found.': 'لم يتم العثور على مركبة.',
    'Loading cars...': 'جارٍ تحميل المركبات...',
    'Loading members...': 'جارٍ تحميل الأعضاء...',
    'Loading requests...': 'جارٍ تحميل الطلبات...',
    'Loading violations...': 'جارٍ تحميل المخالفات...',
    'Loading logs...': 'جارٍ تحميل السجلات...',
    'Loading search...': 'جارٍ تحميل البحث...',
    'Your account is not registered in this system.': 'حسابك غير مسجل في هذا النظام.',
    'Access is currently unavailable for this account.': 'الوصول غير متاح حالياً لهذا الحساب.',
    'Unable to load your account. Please refresh and try again.': 'تعذر تحميل حسابك. حدّث الصفحة ثم أعد المحاولة.',
    'Please enter both email and password.': 'يرجى إدخال البريد الإلكتروني وكلمة المرور.',
    'Please enter a valid manufacture year.': 'يرجى إدخال سنة صنع صحيحة.',
    'Phone number must start with 0 and contain exactly 10 digits.': 'يجب أن يبدأ رقم الهاتف بـ 0 وأن يتكون من 10 أرقام بالضبط.',
    'Phone number must start with 0 and contain exactly 10 digits (e.g. 0501234567).': 'يجب أن يبدأ رقم الهاتف بـ 0 وأن يتكون من 10 أرقام بالضبط، مثل 0501234567.',
    'Username must contain at least 2 characters.': 'يجب أن يحتوي اسم المستخدم على حرفين على الأقل.',
    'Security PIN is incorrect.': 'رمز PIN الأمني غير صحيح.',
    'New Security PIN must be exactly 4 numeric digits.': 'يجب أن يتكون رمز PIN الأمني الجديد من 4 أرقام بالضبط.',
    'New Security PIN and confirmation do not match.': 'رمز PIN الأمني الجديد وتأكيده غير متطابقين.',
    'New Security PIN must be different from the current PIN.': 'يجب أن يختلف رمز PIN الأمني الجديد عن الرمز الحالي.',
    'This username is already taken. Please choose another.': 'اسم المستخدم هذا مستخدم بالفعل. يرجى اختيار اسم آخر.',
    'Profile updated successfully. The page will reload in a moment...': 'تم تحديث الملف الشخصي بنجاح. ستُعاد تحميل الصفحة بعد لحظات...',
    'Only Super Admin can use this secure edit feature.': 'المدير الأعلى فقط يمكنه استخدام ميزة التعديل الآمن هذه.',
    'This request has already been processed.': 'تمت معالجة هذا الطلب بالفعل.',
    'Request already processed.': 'تمت معالجة الطلب بالفعل.',
    'Unable to approve this request. Please refresh and try again.': 'تعذر اعتماد هذا الطلب. حدّث الصفحة ثم أعد المحاولة.',
    'The vehicle is no longer assigned to this requester.': 'لم تعد المركبة مسندة إلى مقدم هذا الطلب.',
    'Unlink request approved. The car is now unassigned.': 'تم اعتماد طلب فك العهدة. المركبة غير مسندة الآن.',
    'Link request approved. The car has been assigned to the user.': 'تم اعتماد طلب العهدة. تم إسناد المركبة إلى المستخدم.',
    'Please complete all car details with valid values.': 'يرجى استكمال جميع تفاصيل المركبة بقيم صحيحة.',
    'This VIN already exists.': 'رقم الهيكل VIN موجود بالفعل.',
    'New car created and assigned to the requester successfully.': 'تم إنشاء مركبة جديدة وإسنادها إلى مقدم الطلب بنجاح.',
    'Unable to create and assign this car. Please try again.': 'تعذر إنشاء المركبة وإسنادها. يرجى إعادة المحاولة.',
    'The request has been rejected.': 'تم رفض الطلب.',
    'Unable to reject this request. Please try again.': 'تعذر رفض الطلب. يرجى إعادة المحاولة.',
    'Enter a valid plate number, code and emirate.': 'أدخل رقم اللوحة والرمز والإمارة بصورة صحيحة.',
    'This car is already assigned to you.': 'هذه المركبة مسندة إليك بالفعل.',
    'Link cancelled. No assignment was changed.': 'تم إلغاء طلب العهدة. لم تتغير أي عهدة.',
    'Unable to process this request. Please try again.': 'تعذر معالجة هذا الطلب. يرجى إعادة المحاولة.',
    'The car is no longer assigned to you.': 'لم تعد المركبة مسندة إليك.',
    'Unlink request sent to admin.': 'تم إرسال طلب فك العهدة إلى المدير.',
    'Unable to create the unlink request. Please try again.': 'تعذر إنشاء طلب فك العهدة. يرجى إعادة المحاولة.',
    'The Violations tab is not available.': 'تبويب المخالفات غير متاح.',
    'Enter a valid plate number using digits only.': 'أدخل رقم لوحة صحيحاً باستخدام الأرقام فقط.',
    'Enter a valid plate code.': 'أدخل رمز لوحة صحيحاً.',
    'Select a valid violation date and time in UAE time.': 'اختر تاريخاً ووقتاً صحيحين للمخالفة بتوقيت الإمارات.',
    'A violation date and time cannot be in the future.': 'لا يمكن أن يكون تاريخ ووقت المخالفة في المستقبل.',
    'Enter a violation type with at least two characters.': 'أدخل نوع مخالفة من حرفين على الأقل.',
    'Enter a valid amount or leave it blank.': 'أدخل مبلغاً صحيحاً أو اترك الحقل فارغاً.',
    'A violation with this reference number already exists.': 'توجد مخالفة بالفعل بهذا الرقم المرجعي.',
    'Could not save the violation. Verify all entered details and try again.': 'تعذر حفظ المخالفة. تحقق من جميع التفاصيل المدخلة ثم أعد المحاولة.',
    'Select a settlement method and enter a settlement note.': 'اختر طريقة تسوية وأدخل ملاحظة للتسوية.',
    'Violation record no longer exists.': 'سجل المخالفة لم يعد موجوداً.',
    'This violation has already been settled.': 'تمت تسوية هذه المخالفة بالفعل.',
    'Could not update the settlement status. Please try again.': 'تعذر تحديث حالة التسوية. يرجى إعادة المحاولة.',
    'Select the actual occurrence date and time. Earlier dates are allowed; future dates are not allowed.': 'اختر تاريخ ووقت وقوع المخالفة الفعليين. التواريخ السابقة مسموحة والتواريخ المستقبلية غير مسموحة.',
    'Add a violation once. The system identifies the car and the assignment active at that time.': 'أضف المخالفة مرة واحدة؛ يحدد النظام المركبة والعهدة النشطة في ذلك الوقت.',
    'Plate number, code, emirate, and occurrence time determine the car and the active assignment.': 'رقم اللوحة والرمز والإمارة ووقت الوقوع تحدد المركبة والعهدة النشطة.',
    'Optional': 'اختياري',
    'Optional but recommended': 'اختياري لكن موصى به',
    'Current assignment': 'العهدة الحالية',
    'Assignment Status': 'حالة العهدة',
    'Violation': 'مخالفة',
    'No violations found.': 'لا توجد مخالفات.',
    'My Assigned Cars': 'مركباتي المسندة',
    '+ Request to Use a Car': '+ طلب استخدام مركبة',
    'Send Request': 'إرسال الطلب',
    'Cars List (Sorted by License Expiry)': 'قائمة المركبات (مرتبة حسب انتهاء الترخيص)',
    'Car Details': 'تفاصيل المركبة',
    'Current User': 'المستخدم الحالي',
    'No user assigned': 'لا يوجد مستخدم مسند',
    'Assign to Me': 'إسنادها إليّ',
    'Request Unlink': 'طلب فك العهدة',
    'Request Link': 'طلب عهدة',
    'View Details': 'عرض التفاصيل',
    'View Activity': 'عرض النشاط',
    'View Violations': 'عرض المخالفات',
    'License': 'الترخيص',
    'Insurance': 'التأمين',
    'Created At': 'تاريخ الإنشاء',
    'Updated At': 'آخر تحديث',
    'Plate Number': 'رقم اللوحة',
    'Owner': 'المالك',
    'Make': 'الشركة المصنعة',
    'Model': 'الطراز',
    'Assignment History': 'سجل العهدة',
    'No assignment history.': 'لا يوجد سجل للعهدة.',
    'Close Details': 'إغلاق التفاصيل',
    'Please enter a manufacture year from 1900 to {maxYear}.': 'يرجى إدخال سنة صنع من 1900 إلى {maxYear}.',
    'Car details updated successfully.': 'تم تحديث تفاصيل المركبة بنجاح.',
    'Car added successfully.': 'تمت إضافة المركبة بنجاح.',
    'This plate combination already exists.': 'تركيبة اللوحة هذه موجودة بالفعل.',
    'This VIN already exists.': 'رقم الهيكل VIN موجود بالفعل.',
    'Error: Form elements not found.': 'خطأ: لم يتم العثور على عناصر النموذج.',
    'Please complete all required fields.': 'يرجى استكمال جميع الحقول المطلوبة.',
    'No assigned cars found.': 'لا توجد مركبات مسندة.',
    'No cars found for this filter.': 'لا توجد مركبات لهذه التصفية.',
    'Pending User Requests': 'طلبات المستخدمين قيد الانتظار',
    'Approve': 'اعتماد',
    'Approve Unlink': 'اعتماد فك العهدة',
    'Reject': 'رفض',
    'Complete Car Details': 'استكمال تفاصيل المركبة',
    'Save & Assign': 'حفظ وإسناد',
    'Search': 'بحث',
    'Search by car, plate, user or VIN...': 'ابحث باسم المركبة أو اللوحة أو المستخدم أو VIN...',
    'System Statistics': 'إحصاءات النظام',
    'Total Cars': 'إجمالي المركبات',
    'Assigned Cars': 'المركبات المسندة',
    'Available Cars': 'المركبات المتاحة',
    'Total Members': 'إجمالي الأعضاء',
    'Active Members': 'الأعضاء النشطون',
    'Pending Requests': 'الطلبات قيد الانتظار',
    'System Logs Timeline': 'الخط الزمني لسجل النظام',
    'No activity records found.': 'لا توجد سجلات نشاط.',
    'No search results found.': 'لا توجد نتائج بحث.',
    'No pending requests.': 'لا توجد طلبات قيد الانتظار.',
    'No members found.': 'لا يوجد أعضاء.',
    'No logs found.': 'لا توجد سجلات.',
    'My Violations': 'مخالفاتي',
    'Confirm Official Settlement': 'تأكيد التسوية الرسمية',
    'Paid': 'تم الدفع',
    'Official Objection': 'اعتراض رسمي',
    'Other Settlement': 'تسوية أخرى',
    'Select settlement method': 'اختر طريقة التسوية',
    'Optional details': 'تفاصيل اختيارية',
    'Optional but recommended': 'اختياري لكن موصى به',
    'No assignment': 'لا توجد عهدة',
    'No car': 'لا توجد مركبة',
    'Review required': 'تتطلب مراجعة',
    'Occurred': 'وقت الوقوع',
    'Created': 'تاريخ الإنشاء',
    'Settled by': 'تمت التسوية بواسطة',
    'User context:': 'سياق المستخدم:',
    'Vehicle context:': 'سياق المركبة:',
    'Enter the actual plate and time; the system will determine the responsible driver.': 'أدخل بيانات اللوحة ووقت الوقوع الفعليين؛ سيحدد النظام المستخدم المسؤول.',
    'Loading your violations...': 'جارٍ تحميل مخالفاتك...',
    'Unable to load your violations.': 'تعذر تحميل مخالفاتك.',
    'Unable to load violations. Please try again.': 'تعذر تحميل المخالفات. يرجى إعادة المحاولة.',
    'Unable to load violations for this car.': 'تعذر تحميل مخالفات هذه المركبة.',
    'Unable to load violations for this user.': 'تعذر تحميل مخالفات هذا المستخدم.',
    'by': 'بواسطة',
    'Target:': 'الهدف:',
    'System': 'النظام',
    'Activity': 'نشاط',
    'Automatically Linked': 'مرتبطة تلقائياً',
    'No Assignment at This Time': 'لا توجد عهدة في ذلك الوقت',
    'Unknown Status': 'حالة غير معروفة',
    'Official Payment': 'دفع رسمي',
    'Official Objection': 'اعتراض رسمي',
    'Other Official Settlement': 'تسوية رسمية أخرى',
    'Not specified': 'غير محدد',
    'Violation occurrence date and time in UAE time': 'تاريخ ووقت وقوع المخالفة بتوقيت الإمارات',
    'AM or PM': 'AM أو PM',
    'Assignment': 'العهدة',
    'Assigned to:': 'مسندة إلى:',
    'Currently unassigned': 'غير مسندة حالياً',
    'Unassigned': 'غير مسندة',
    'days left': 'يوماً متبقياً',
    'Type': 'النوع',
    'Print': 'طباعة',
    'History': 'السجل',
    'Unassign': 'فك العهدة',
    'Assign': 'إسناد',
    'My History': 'سجلي',
    'Loading your cars...': 'جارٍ تحميل مركباتك...',
    'No cars found.': 'لا توجد مركبات.',
    'No cars match the current filter.': 'لا توجد مركبات مطابقة للتصفية الحالية.',
    'No cars assigned to you currently.': 'لا توجد مركبات مسندة إليك حالياً.',
    'Unable to load cars. Please try again.': 'تعذر تحميل المركبات. يرجى إعادة المحاولة.',
    'Unable to load your cars. Please try again.': 'تعذر تحميل مركباتك. يرجى إعادة المحاولة.',
    'A pending unlink request already exists for this car. Please wait for the administrator decision.': 'يوجد بالفعل طلب فك عهدة معلق لهذه المركبة. يرجى انتظار قرار المدير.',
    'Send an unlink request to the administrator? The car remains assigned to you until approval.': 'إرسال طلب فك العهدة إلى المدير؟ ستبقى المركبة بعهدتك حتى اعتماد الطلب.',
    'Notifications': 'الإشعارات',
    'Messages': 'الرسائل',
    'Review assignment, custody, violation, and message notices.': 'راجع إشعارات التعيين والعهدة والمخالفات والرسائل.',
    'Loading notifications...': 'جارٍ تحميل الإشعارات...',
    'Unable to load notifications. Please try again.': 'تعذر تحميل الإشعارات. يرجى إعادة المحاولة.',
    'No notifications found.': 'لا توجد إشعارات.',
    'New': 'جديد',
    'Read': 'تمت القراءة',
    'Issued by': 'صادر بواسطة',
    'Issued': 'وقت الإصدار',
    'Acknowledged': 'تم الاطلاع',
    'Acknowledge': 'تم الاطلاع',
    'Notification acknowledged.': 'تم تسجيل الاطلاع على الإشعار.',
    'Unable to acknowledge this notification. Please try again.': 'تعذر تسجيل الاطلاع على الإشعار. يرجى إعادة المحاولة.',
    'Message Management': 'مراسلة الإدارة',
    'System': 'النظام',
    'Management': 'الإدارة',
    'Recipient': 'المستلم',
    'Select recipient': 'اختر المستلم',
    'New Message': 'رسالة جديدة',
    'Send Internal Message': 'إرسال رسالة داخلية',
    'Messages may be viewed and answered by all authorised administrators.': 'قد يطّلع جميع المسؤولين المخولين على الرسائل ويجيبون عنها.',
    'Message': 'الرسالة',
    'Write your message here...': 'اكتب رسالتك هنا...',
    'Send Message': 'إرسال الرسالة',
    'Sending...': 'جارٍ الإرسال...',
    'Select a recipient before sending the message.': 'اختر مستلماً قبل إرسال الرسالة.',
    'Enter a message before sending.': 'أدخل رسالة قبل الإرسال.',
    'Message sent successfully.': 'تم إرسال الرسالة بنجاح.',
    'Unable to send the message. Please try again.': 'تعذر إرسال الرسالة. يرجى إعادة المحاولة.',
    'Loading messages...': 'جارٍ تحميل الرسائل...',
    'Unable to load messages. Please try again.': 'تعذر تحميل الرسائل. يرجى إعادة المحاولة.',
    'No messages found.': 'لا توجد رسائل.',
    'Administrators can view and reply to all internal messages.': 'يمكن للمسؤولين الاطلاع على جميع الرسائل الداخلية والرد عليها.',
    'Send messages only to management. All authorised administrators may review and reply.': 'ترسل الرسائل إلى الإدارة فقط. ويمكن لجميع المسؤولين المخولين الاطلاع عليها والرد عليها.',
    'Sent': 'مرسلة',
    'To': 'إلى',
    'Related to': 'مرتبطة بـ',
    'GENERAL': 'عام',
    'ASSIGNMENT': 'تعيين مركبة',
    'UNLINK_APPROVED': 'فك عهدة معتمد',
    'REASSIGNED': 'نقل عهدة',
    'VIOLATION': 'مخالفة',
    'General': 'عام',
    'Vehicle Assignment': 'تعيين مركبة',
    'Custody Release': 'فك عهدة',
    'Vehicle Reassignment': 'نقل عهدة'
});

let activeLanguage = readStoredLanguage();
let observer = null;
let applyingTranslations = false;

function readStoredLanguage() {
    try {
        const language = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        return SUPPORTED_LANGUAGES.has(language) ? language : 'en';
    } catch {
        return 'en';
    }
}

function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function replaceVariables(text, variables = {}) {
    return String(text).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => formatLatinText(variables[key] ?? `{${key}}`));
}

function sourceForNode(node) {
    if (!node.dataset.i18nSource) node.dataset.i18nSource = node.textContent || '';
    return node.dataset.i18nSource;
}

function shouldSkip(element) {
    return !element || element.closest('script, style, pre, code, .plate-container, .plate-wrapper, .plate-number, .plate-code, .plate-emirate, [data-no-translate]');
}

function translateElementText(element) {
    if (!element || shouldSkip(element)) return;
    const source = sourceForNode(element);
    const key = normalizeText(source);
    if (!key || !(translations.en[key] || translations.ar[key])) return;
    element.textContent = activeLanguage === 'ar' ? translations.ar[key] || source : source;
}

function translateAttributes(element) {
    if (!element || shouldSkip(element)) return;
    ['placeholder', 'title', 'aria-label', 'alt'].forEach(attribute => {
        const currentValue = element.getAttribute(attribute);
        if (!currentValue) return;
        const sourceKey = `i18n${attribute.charAt(0).toUpperCase()}${attribute.slice(1)}Source`;
        if (!element.dataset[sourceKey]) element.dataset[sourceKey] = currentValue;
        const source = element.dataset[sourceKey];
        const key = normalizeText(source);
        if (translations.en[key] || translations.ar[key]) element.setAttribute(attribute, activeLanguage === 'ar' ? translations.ar[key] || source : source);
    });
}

function translateTree(root = document.body) {
    if (!root) return;
    const elements = root.matches?.('*') ? [root, ...root.querySelectorAll('*')] : [...root.querySelectorAll('*')];
    elements.forEach(element => {
        translateAttributes(element);
        const directTextNodes = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && normalizeText(node.nodeValue));
        directTextNodes.forEach(node => {
            if (shouldSkip(element)) return;
            const sourceKey = 'i18nSource';
            if (!node[sourceKey]) node[sourceKey] = node.nodeValue;
            const source = node[sourceKey];
            const key = normalizeText(source);
            if (translations.en[key] || translations.ar[key]) node.nodeValue = activeLanguage === 'ar' ? translations.ar[key] || source : source;
        });
    });
}

function observeTranslations() {
    if (observer || !document.body) return;
    observer = new MutationObserver(records => {
        if (applyingTranslations) return;
        applyingTranslations = true;
        records.forEach(record => {
            record.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) translateTree(node);
                if (node.nodeType === Node.TEXT_NODE && node.parentElement && !shouldSkip(node.parentElement)) {
                    const key = normalizeText(node.nodeValue);
                    if (translations.en[key] || translations.ar[key]) {
                        node.i18nSource = node.nodeValue;
                        node.nodeValue = activeLanguage === 'ar' ? translations.ar[key] || node.nodeValue : node.nodeValue;
                    }
                }
            });
        });
        applyingTranslations = false;
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

export function getLanguage() {
    return activeLanguage;
}

export function isArabic() {
    return activeLanguage === 'ar';
}

export function t(key, variables = {}) {
    const source = translations.en[key] || key;
    const translated = activeLanguage === 'ar' ? translations.ar[key] || source : source;
    return replaceVariables(translated, variables);
}

export function translateLogAction(actionType) {
    const labels = {
        ACTIVATE_USER: ['Activated user', 'تم تفعيل المستخدم'],
        APPROVE_LINK: ['Approved link request', 'تم اعتماد طلب العهدة'],
        APPROVE_UNLINK: ['Approved unlink request', 'تم اعتماد طلب فك العهدة'],
        AUTO_LINK_CONFIRMED: ['Auto link confirmed', 'تم تأكيد الربط التلقائي'],
        CAR_ASSIGN: ['Assigned vehicle', 'تم إسناد المركبة'],
        CAR_UNASSIGN: ['Unassigned vehicle', 'تم فك عهدة المركبة'],
        CHANGE_PASSWORD: ['Changed password', 'تم تغيير كلمة المرور'],
        CREATE_CAR: ['Created vehicle', 'تم إنشاء مركبة'],
        CREATE_USER: ['Created user', 'تم إنشاء مستخدم'],
        CREATE_VIOLATION: ['Created violation', 'تم إنشاء مخالفة'],
        DEMOTE_USER: ['Removed administrator role', 'تمت إزالة صلاحية الإدارة'],
        EDIT_CAR: ['Edited vehicle', 'تم تعديل مركبة'],
        EDIT_SELF_PROFILE: ['Edited protected profile', 'تم تعديل الملف المحمي'],
        EDIT_USER: ['Edited user', 'تم تعديل مستخدم'],
        LOGIN_FAILED: ['Failed login attempt', 'محاولة دخول غير ناجحة'],
        PROMOTE_USER: ['Promoted user to administrator', 'تمت ترقية المستخدم إلى مدير'],
        REJECT_REQUEST: ['Rejected request', 'تم رفض الطلب'],
        REQUEST_LINK: ['Requested vehicle assignment', 'تم طلب عهدة مركبة'],
        REQUEST_UNLINK: ['Requested vehicle unlink', 'تم طلب فك عهدة مركبة'],
        SETTLE_VIOLATION: ['Settled violation', 'تمت تسوية مخالفة'],
        SUSPEND_USER: ['Suspended user', 'تم إيقاف المستخدم']
    };
    const label = labels[String(actionType || '')];
    if (!label) return translateText(actionType || 'Activity');
    return activeLanguage === 'ar' ? label[1] : label[0];
}

export function translateText(text) {
    const source = String(text ?? '');
    const key = normalizeText(source);
    if (!key || activeLanguage === 'en') return source;
    if (translations.ar[key]) return translations.ar[key];

    const patterns = [
        [/^Error: Please enter a valid manufacture year \(1900-(\d+)\)\.$/, (_, maxYear) => `خطأ: يرجى إدخال سنة صنع صحيحة من 1900 إلى ${maxYear}.`],
        [/^Please enter a manufacture year from 1900 to (\d+)\.$/, (_, maxYear) => `يرجى إدخال سنة صنع من 1900 إلى ${maxYear}.`],
        [/^Violation ([A-Za-z0-9_-]+) saved: (.+)\.$/, (_, violationId, status) => `تم حفظ المخالفة ${violationId}: ${translateText(status)}.`],
        [/^Violation ([A-Za-z0-9_-]+) marked as settled\.$/, (_, violationId) => `تمت تسوية المخالفة ${violationId}.`],
        [/^Car (.+) has been linked to you\. You are now responsible for this vehicle\.$/, (_, label) => `تم ربط المركبة ${label} بك. أصبحت مسؤولاً عنها الآن.`],
        [/^Vehicle context loaded: (.+)\. The driver will still be determined from the violation time\.$/, (_, label) => `تم تحميل سياق المركبة: ${label}. سيُحدد المستخدم المسؤول وفق وقت المخالفة.`],
        [/^User context: (.+)\. Enter the actual plate and time; the system will determine the responsible driver\.$/, (_, name) => `سياق المستخدم: ${name}. أدخل بيانات اللوحة ووقت الوقوع الفعليين؛ سيحدد النظام المستخدم المسؤول.`],
        [/^Created car (.+)$/, (_, label) => `تم إنشاء المركبة ${label}`],
        [/^Edited car (.+)$/, (_, label) => `تم تعديل المركبة ${label}`],
        [/^Created violation ([A-Za-z0-9_-]+): (.+)\.$/, (_, violationId, status) => `تم إنشاء المخالفة ${violationId}: ${translateText(status)}.`]
    ];

    for (const [pattern, formatter] of patterns) {
        const match = source.match(pattern);
        if (match) return formatter(...match);
    }
    return source;
}

export function formatLatinText(value) {
    return String(value ?? '')
        .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
        .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

export function formatNumber(value, options = {}) {
    return new Intl.NumberFormat('en-GB-u-nu-latn', options).format(Number(value ?? 0));
}

export function formatDate(value, options = {}) {
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return t('N/A');
    const locale = activeLanguage === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB-u-nu-latn';
    return new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Dubai', ...options })
        .format(date)
        .replace(/([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s*)ص/g, '$1AM')
        .replace(/([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s*)م/g, '$1PM');
}

export function setLanguage(language, options = {}) {
    const nextLanguage = SUPPORTED_LANGUAGES.has(language) ? language : 'en';
    activeLanguage = nextLanguage;
    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
        activeLanguage = nextLanguage;
    }

    applyingTranslations = true;
    document.documentElement.lang = nextLanguage;
    document.documentElement.dir = nextLanguage === 'ar' ? 'rtl' : 'ltr';
    document.body?.classList.toggle('language-ar', nextLanguage === 'ar');
    document.body?.classList.toggle('language-en', nextLanguage === 'en');
    document.title = t('System Management');
    document.querySelectorAll('[data-language-option]').forEach(button => {
        const selected = button.dataset.languageOption === nextLanguage;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    translateTree();
    applyingTranslations = false;

    if (!options.silent) document.dispatchEvent(new CustomEvent('app-language-change', { detail: { language: nextLanguage } }));
}

export function initializeI18n() {
    document.addEventListener('input', event => {
        const field = event.target;
        if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || field.type === 'password') return;
        const normalized = formatLatinText(field.value);
        if (normalized !== field.value) field.value = normalized;
    });
    document.addEventListener('paste', event => {
        const field = event.target;
        if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || field.type === 'password') return;
        const pasted = event.clipboardData?.getData('text') || '';
        const normalized = formatLatinText(pasted);
        if (normalized === pasted) return;
        event.preventDefault();
        const start = field.selectionStart ?? field.value.length;
        const end = field.selectionEnd ?? field.value.length;
        field.setRangeText(normalized, start, end, 'end');
        field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    observeTranslations();
    setLanguage(activeLanguage, { silent: true });
}

export function attachLanguageSwitcher() {
    document.querySelectorAll('[data-language-option]').forEach(button => {
        button.addEventListener('click', () => setLanguage(button.dataset.languageOption));
    });
}

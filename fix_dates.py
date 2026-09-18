import os
import glob
import re

utils_import = "import { formatDateTime, formatTimeOnly, formatDateOnly } from '../utils/dateTime';\n"
utils_import_level1 = "import { formatDateTime, formatTimeOnly, formatDateOnly } from './utils/dateTime';\n"

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    level = filepath.count('/') - filepath.find('src/') - 1
    import_stmt = utils_import if level > 0 else utils_import_level1
    
    # Check if formatDateTime is already imported
    if "formatDateTime" not in content and "new Date(" in content and filepath.endswith('.jsx'):
        # insert import after last lucide-react or react import
        import_idx = content.rfind("from 'lucide-react';")
        if import_idx != -1:
            end_idx = content.find('\n', import_idx) + 1
            content = content[:end_idx] + import_stmt + content[end_idx:]
        else:
            import_idx = content.rfind("from 'react';")
            if import_idx != -1:
                end_idx = content.find('\n', import_idx) + 1
                content = content[:end_idx] + import_stmt + content[end_idx:]

    # Replacements
    # new Date(X).toLocaleString() -> formatDateTime(X)
    content = re.sub(r'new Date\(([^)]+)\)\.toLocaleString\(\)', r'formatDateTime(\1)', content)
    # new Date(X).toLocaleDateString() -> formatDateOnly(X)
    content = re.sub(r'new Date\(([^)]+)\)\.toLocaleDateString\(\)', r'formatDateOnly(\1)', content)
    # new Date(X).toLocaleTimeString(args) -> formatTimeOnly(X)
    content = re.sub(r'new Date\(([^)]+)\)\.toLocaleTimeString\([^)]*\)', r'formatTimeOnly(\1)', content)
    
    # For Dashboard relative time diff
    if 'Date.now() - new Date(iso).getTime()' in content:
        content = content.replace('new Date(iso).getTime()', "(new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime())")
        
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.jsx'):
            process_file(os.path.join(root, file))

